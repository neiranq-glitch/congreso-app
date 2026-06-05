import { AuthProvider } from '@/context/AuthContext'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'Congreso App',
  description: 'Sistema de registro para el congreso',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}