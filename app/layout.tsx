import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Prompt Chain Tool · Caption Clash",
    description: "Build, reorder and run the LLM prompt chains behind Caption Clash",
    robots: { index: false, follow: false },
};

// Runs before paint so there's no flash of the wrong theme.
// "system" (default) follows the OS and keeps following it if it changes.
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="en" className="h-full antialiased" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
            </head>
            <body className="min-h-full">{children}</body>
        </html>
    );
}
