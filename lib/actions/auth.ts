'use server'

// Server actions de autenticación (Fase 7, V1) — ver lib/auth.ts para el
// hashing/firma de sesión.

import { redirect } from 'next/navigation'
import { createSession, destroySession, verifyCredentials } from '@/lib/auth'

export interface LoginInput {
  username: string
  password: string
}

export async function login(input: LoginInput) {
  if (!input.username?.trim() || !input.password) {
    throw new Error('Usuario y contraseña son obligatorios')
  }

  const valid = await verifyCredentials(input.username.trim(), input.password)
  if (!valid) {
    throw new Error('Usuario o contraseña incorrectos')
  }

  await createSession(input.username.trim())
}

export async function logout() {
  await destroySession()
  redirect('/login')
}
