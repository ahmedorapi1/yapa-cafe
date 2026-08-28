import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host =
    incomingHeaders.get("x-forwarded-host") ??
    incomingHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    incomingHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/og.png`;

  return {
    title: {
      default: "Yapa Café — اطلب من ترابيزتك",
      template: "%s · Yapa Café",
    },
    description:
      "منيو Yapa الرقمية — اختار مشروبك واطلبه مباشرة من ترابيزتك.",
    applicationName: "Yapa Café",
    keywords: ["Yapa", "café", "QR menu", "ordering", "قهوة", "كافيه"],
    openGraph: {
      title: "Yapa Café — اطلب من ترابيزتك",
      description: "مشروبك المفضل، على ترابيزتك. تجربة طلب بسيطة ودافئة من Yapa.",
      type: "website",
      locale: "ar_EG",
      siteName: "Yapa Café",
      images: [{ url: socialImage, width: 1536, height: 1024, alt: "Yapa Café" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Yapa Café",
      description: "مشروبك المفضل، على ترابيزتك.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
