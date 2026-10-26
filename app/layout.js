import './globals.css';
export const metadata = {
  applicationName: 'Pause',
  title: 'Pause | Check before you trust',
  description: 'Check a suspicious message, screenshot, QR code, or link and understand what to do next.',
  openGraph: {
    title: 'Pause | Check before you trust',
    description: 'A second opinion for suspicious messages, screenshots, QR codes, and links.',
    siteName: 'Pause',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Pause | Check before you trust',
    description: 'A second opinion for suspicious messages, screenshots, QR codes, and links.',
  },
};
export default function RootLayout({ children }) {
  return (<html lang="en"><body>{children}</body></html>);
}
