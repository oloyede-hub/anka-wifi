import { Navbar, Footer } from "@/components/layout";
import { PaymentStatus } from "@/components/payment/PaymentStatus";
export const metadata = {
  title: "Confirm Payment | Anka WiFi",
  robots: { index: false, follow: false },
};
export default async function Callback({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const reference = params.reference ?? params.trxref;
  const value = typeof reference === "string" ? reference : "";
  return (
    <>
      <Navbar />
      <main
        id="main-content"
        className="grid min-h-[70vh] flex-1 place-items-center bg-[#f4f8fc] px-4 py-8 md:px-5 md:py-[60px]"
      >
        <PaymentStatus key={value} reference={value} />
      </main>
      <Footer />
    </>
  );
}
