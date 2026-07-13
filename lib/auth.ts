// Autenticación mínima (Fase 7, V1) — un solo usuario administrador, sin
// multi-tenant, sin roles. Sin librería de auth externa: hashing con
// `crypto.scrypt` (nativo de Node) y sesión como cookie HttpOnly firmada con
// HMAC-SHA256 (sin tabla de sesiones — stateless, expira sola).
//
// Bootstrap: la PRIMERA vez que alguien hace login con
// ADMIN_USERNAME/ADMIN_PASSWORD (variables de entorno) y todavía no existe
// ningún AdminAccount en la base, se crea automáticamente con el password
// ya hasheado. De ahí en adelante las credenciales viven en la base, no en
// las variables de entorno — cambiar el password no requiere redeploy.

import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE_NAME } from '@/lib/session-constants'

export { SESSION_COOKIE_NAME }
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30 // 30 días

/**
 * Lee y valida las variables de entorno de las que depende la autenticación.
 * Lanza un error explícito (no un fallo silencioso) si falta alguna — ver
 * Sección 11 del spec V1: "agregar validación de variables de entorno,
 * mostrar un error visible si falta configuración".
 */
function getAuthEnv() {
  const sessionSecret = process.env.SESSION_SECRET
  if (!sessionSecret || sessionSecret.length < 16) {
    throw new Error(
      'Falta configurar SESSION_SECRET (o es muy corto, mínimo 16 caracteres) en las variables de entorno. ' +
        'Sin esto la aplicación no puede firmar sesiones de forma segura y no debe arrancar.'
    )
  }
  return { sessionSecret }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

function verifyPasswordHash(password: string, stored: string): boolean {
  const [salt, derivedHex] = stored.split(':')
  if (!salt || !derivedHex) return false
  const derived = scryptSync(password, salt, 64)
  const storedBuffer = Buffer.from(derivedHex, 'hex')
  if (derived.length !== storedBuffer.length) return false
  return timingSafeEqual(derived, storedBuffer)
}

function signSessionValue(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

function createSessionCookieValue(username: string): string {
  const { sessionSecret } = getAuthEnv()
  const expiresAt = Date.now() + SESSION_DURATION_MS
  const payload = `${username}.${expiresAt}`
  const signature = signSessionValue(payload, sessionSecret)
  return `${payload}.${signature}`
}

function verifySessionCookieValue(value: string): { username: string } | null {
  const { sessionSecret } = getAuthEnv()
  const parts = value.split('.')
  if (parts.length !== 3) return null
  const [username, expiresAtStr, signature] = parts
  const payload = `${username}.${expiresAtStr}`
  const expectedSignature = signSessionValue(payload, sessionSecret)

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null
  }

  const expiresAt = Number(expiresAtStr)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null

  return { username }
}

/**
 * Verifica username/password. Si es la primera vez y coincide con
 * ADMIN_USERNAME/ADMIN_PASSWORD (bootstrap) y no existe ningún AdminAccount
 * todavía, lo crea. Devuelve true si las credenciales son válidas.
 */
export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const existingCount = await prisma.adminAccount.count()

  if (existingCount === 0) {
    const bootstrapUsername = process.env.ADMIN_USERNAME
    const bootstrapPassword = process.env.ADMIN_PASSWORD
    if (!bootstrapUsername || !bootstrapPassword) {
      throw new Error(
        'No existe ningún usuario administrador todavía y faltan ADMIN_USERNAME/ADMIN_PASSWORD en las variables de entorno para crear el primero.'
      )
    }
    if (username !== bootstrapUsername || password !== bootstrapPassword) {
      return false
    }
    await prisma.adminAccount.create({
      data: { username, passwordHash: hashPassword(password) },
    })
    return true
  }

  const account = await prisma.adminAccount.findUnique({ where: { username } })
  if (!account) return false

  return verifyPasswordHash(password, account.passwordHash)
}

export async function createSession(username: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, createSessionCookieValue(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function getSession(): Promise<{ username: string } | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!value) return null
  return verifySessionCookieValue(value)
}

/** Guarda de autenticación para server actions — lanza si no hay sesión válida. */
export async function requireSession(): Promise<{ username: string }> {
  const session = await getSession()
  if (!session) {
    throw new Error('No autenticado — inicia sesión para realizar esta acción.')
  }
  return session
}
