import { Navbar, Footer } from "@/components/layout";
import {
  Hero,
  Benefits,
  HowItWorks,
  PaymentRecovery,
} from "@/components/home/sections";
import { Packages } from "@/components/home/Packages";
export default function Home() {
  return (
    <>
      <Navbar />
      <main id="home">
        <Hero />
        <Packages />
        <Benefits />
        <HowItWorks />
        <PaymentRecovery />
      </main>
      <Footer />
    </>
  );
}
