import Image from "next/image";
import { LoginForm } from "./form";

export default async function Login({ searchParams }: PageProps<"/admin/login">) {
  const kein = (await searchParams)["kein-zugriff"];
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-14">
      <Image src="/logo@2x.png" alt="Heiglerhof" width={96} height={95} className="mx-auto" />
      <h1 className="mt-3 text-center text-3xl font-bold">Hofkasse Admin</h1>
      {kein && <p className="mt-3 rounded-lg bg-[#fbe9e7] p-3 text-bad">Dieses Konto hat keinen Zugang zum Adminbereich.</p>}
      <LoginForm />
    </main>
  );
}
