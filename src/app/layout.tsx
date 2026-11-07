import type { Metadata, Viewport } from 'next';
export const metadata: Metadata = {
  title: 'Gymia · Tu gimnasio, en orden',
  description: 'Administración de gimnasios, membresías, ventas y entrenamiento.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Gymia' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f1f4f9' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href="/gymia.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
