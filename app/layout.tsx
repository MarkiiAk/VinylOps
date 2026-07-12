import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";

// Space Grotesk: fuente de headings con caracter tecnico/taller.
// Inter: fuente de body/datos, alta legibilidad en tablas y numeros.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VinylOps Pricing Studio",
  description:
    "Herramienta interna de cotizacion e inventario para produccion de vinil/Cricut.",
  manifest: "/manifest.json",
  applicationName: "VinylOps",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VinylOps",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  // Next 16 emite el meta "mobile-web-app-capable" (spec vigente) a partir de
  // appleWebApp.capable, pero iOS < 16.4 solo reconoce el nombre legacy
  // "apple-mobile-web-app-capable". Se agrega a mano para no perder
  // instalabilidad en esas versiones.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${spaceGrotesk.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          {children}
          <Toaster />
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
