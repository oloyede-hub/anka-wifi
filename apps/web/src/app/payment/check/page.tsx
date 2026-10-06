import { Navbar, Footer } from "@/components/layout";
import { PaymentCheck } from "@/components/payment/PaymentStatus";
export const metadata = {
  title: "Check Payment | Anka WiFi",
  robots: { index: false, follow: false },
};
export default function CheckPayment() {
  return (
    <>
      <Navbar />
      <main
        id="main-content"
        className="grid min-h-[70vh] flex-1 place-items-center bg-surface-page px-4 py-8 md:px-5 md:py-[60px]"
      >
        <PaymentCheck />
      </main>
      <Footer />
    </>
  );
}
