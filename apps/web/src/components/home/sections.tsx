import { Icon } from "../Icon";
export function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[#edf6fa] bg-[url('/images/hero-image.png')] bg-cover bg-[position:70%_center] bg-no-repeat md:bg-center"
      id="main-content"
    >
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,#f0f8fcf5_0%,#f0f8fce8_60%,#f0f8fc99_100%)] md:bg-[linear-gradient(90deg,#f0f8fc_0%,#f0f8fcdd_32%,#f0f8fc55_52%,transparent_72%)]"
        aria-hidden="true"
      />
      <div className="mx-auto w-[calc(100%-40px)] max-w-[1080px] md:w-[calc(100%-64px)] flex min-h-[460px] items-center md:min-h-[438px] min-[1400px]:min-h-[470px]">
        <div className="relative z-10 w-full py-11 md:w-[56%] md:py-12 lg:w-[52%] lg:max-w-[540px]">
          <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[#607394] [&_span]:px-[7px]">
            FAST <span>•</span> SECURE <span>•</span> AFFORDABLE
          </p>
          <h1 className="text-[clamp(36px,7.8vw,54px)] font-extrabold leading-[1.04] tracking-tight md:text-[clamp(36px,4.7vw,59px)] [&_span]:text-brand">
            Stay Connected
            <br />
            with <span>Anka WiFi</span>
          </h1>
          <p className="mt-[22px] max-w-[500px] text-base leading-relaxed text-muted md:max-w-[465px] md:text-[17px]">
            Get reliable internet access in just a few minutes. Choose a plan,
            make a secure payment, and start browsing.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-5 md:gap-7">
            <a
              className="inline-flex min-h-[49px] items-center justify-center gap-3.5 rounded-xl border border-transparent px-6 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none disabled:cursor-wait disabled:opacity-60 bg-brand text-white shadow-[0_8px_24px_#1768ff18] hover:bg-brand-dark"
              href="#packages"
            >
              View Packages <Icon name="arrow" />
            </a>
            <a
              className="inline-flex items-center gap-2.5 font-medium text-brand-dark underline"
              href="#how-it-works"
            >
              <Icon name="play" />
              How it works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
export function Benefits() {
  const benefits = [
    {
      icon: "bolt",
      title: "Fast & Reliable",
      text: "Reliable internet access",
    },
    {
      icon: "shield",
      title: "Secure Payment",
      text: "Pay securely with Paystack",
    },
    { icon: "check", title: "Simple Setup", text: "Purchase in a few steps" },
    {
      icon: "clock",
      title: "Instant Access",
      text: "Your code after payment confirmation",
    },
  ] as const;
  return (
    <section
      className="mx-auto w-[calc(100%-40px)] max-w-[1080px] md:w-[calc(100%-64px)] grid grid-cols-1 gap-x-[18px] gap-y-[26px] py-6 min-[381px]:grid-cols-2 md:gap-6 md:py-[30px] lg:grid-cols-4"
      aria-label="Why Anka WiFi"
    >
      {benefits.map((item) => (
        <div
          className="relative flex items-start gap-2.5 md:gap-3.5 lg:[&+div]:before:absolute lg:[&+div]:before:top-[5px] lg:[&+div]:before:-left-3.5 lg:[&+div]:before:h-[55px] lg:[&+div]:before:border-l lg:[&+div]:before:border-line [&_h3]:my-[5px] [&_h3]:text-sm [&_h3]:font-bold [&_h3]:leading-tight [&_h3]:tracking-tight md:[&_h3]:text-[15px] [&_p]:text-xs [&_p]:leading-normal [&_p]:text-muted md:[&_p]:text-[13px]"
          key={item.title}
        >
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#eaf2ff] text-brand md:size-[58px] [&_svg]:size-6 md:[&_svg]:size-[29px]">
            <Icon name={item.icon} />
          </span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
export function HowItWorks() {
  const steps = [
    ["Choose a Package", "Select the Wi-Fi package that works for you."],
    ["Pay Securely", "Enter your details and complete payment securely."],
    [
      "Get Your Access Code",
      "After payment confirmation, receive your Wi-Fi access code.",
    ],
  ];
  return (
    <section
      className="mx-auto w-[calc(100%-40px)] max-w-[1080px] md:w-[calc(100%-64px)] pt-[25px] pb-[42px] md:pt-[30px]"
      id="how-it-works"
    >
      <div className="mb-7 text-center [&_h2]:text-[29px] [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:tracking-tight md:[&_h2]:text-[32px] [&_p:last-child]:mt-2.5 [&_p:last-child]:text-[15px] [&_p:last-child]:text-muted">
        <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[#607394] [&_span]:px-[7px]">
          ONLINE IN A FEW STEPS
        </p>
        <h2>How It Works</h2>
      </div>
      <ol className="grid list-none grid-cols-1 gap-6 md:grid-cols-3 md:gap-8 md:text-center [&_li]:relative [&_li]:pl-14 md:[&_li]:px-[15px] [&_span]:absolute [&_span]:top-0 [&_span]:left-0 [&_span]:mb-3 [&_span]:inline-flex [&_span]:size-[38px] [&_span]:items-center [&_span]:justify-center [&_span]:rounded-full [&_span]:bg-[#eff5ff] [&_span]:text-[13px] [&_span]:font-bold [&_span]:text-brand md:[&_span]:static [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:font-bold [&_h3]:leading-tight [&_h3]:tracking-tight [&_p]:text-sm [&_p]:text-muted">
        {steps.map(([title, text], i) => (
          <li key={title}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function PaymentRecovery() {
  return (
    <section className="mx-auto w-[calc(100%-40px)] max-w-[1080px] md:w-[calc(100%-64px)] mb-7 flex flex-wrap items-center gap-[18px] rounded-[18px] bg-linear-to-r from-[#eff5f9] to-[#f4f8fb] p-[25px] md:flex-nowrap md:gap-[22px] md:px-8 md:py-[26px] lg:gap-11 [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:tracking-tight md:[&_h2]:text-[28px] [&_p]:text-sm [&_p]:text-muted [&>div:nth-child(2)]:min-w-40 [&>div:nth-child(2)]:flex-1">
      <div className="flex w-[60px] shrink-0 justify-center md:w-[125px] lg:w-[210px] [&_svg]:size-[60px] [&_svg]:rounded-full [&_svg]:bg-[#e6f0fb] [&_svg]:p-[11px] [&_svg]:text-brand md:[&_svg]:size-[115px] md:[&_svg]:p-6">
        <Icon />
      </div>
      <div>
        <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[#607394] [&_span]:px-[7px]">
          NEED HELP?
        </p>
        <h2>Check Your Payment</h2>
        <p>
          Already made a payment? Verify your payment
          <br className="hidden md:block" /> and retrieve your access code.
        </p>
      </div>
      <a
        className="inline-flex min-h-[49px] items-center justify-center gap-3.5 border px-6 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none disabled:cursor-wait disabled:opacity-60 rounded-full border-[#b9d1ff] bg-white text-brand-dark hover:bg-[#eef5ff] w-full whitespace-nowrap md:ml-auto md:w-auto"
        href="/payment/check"
      >
        Check Payment <Icon name="arrow" />
      </a>
    </section>
  );
}
