import Image from "next/image";

function ServeXBrand() {
  return (
    <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-950">
      Serve
      <span className="ml-[2px] inline-block text-[3.65rem] leading-none text-red-600">
        X
      </span>
    </h1>
  );
}

export default function CreateRestaurant() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-7 py-8 text-center">
        <Image
          src="/logo.png"
          alt="ServeX Logo"
          width={80}
          height={80}
          className="mx-auto rounded-2xl object-cover shadow-[0_16px_45px_rgba(220,38,38,0.28)]"
          priority
        />

        <ServeXBrand />

        <section className="mt-8 rounded-[26px] border border-red-100 bg-red-50 px-5 py-6">
          <p className="text-2xl font-black text-slate-950">
            Restaurant creation is disabled
          </p>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            This page no longer accepts browser-side admin credentials. Create restaurant workspaces from a secure server-side admin flow or Supabase/admin setup.
          </p>
        </section>
      </div>
    </main>
  );
}
