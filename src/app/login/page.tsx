"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast, Toaster } from "sonner";

export default function LoginPage() {
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [loading, setLoading] = useState(false);
 const router = useRouter();

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  try {
   const result = await signIn("credentials", {
    redirect: false,
    email,
    password,
   });

   if (result?.error) {
    toast.error("Falha no login", {
     description: "E-mail ou senha incorretos. Por favor, tente novamente.",
    });
   } else if (result?.ok) {
    router.push("/");
   }
  } catch (error) {
   console.error("Erro no login:", error);
   toast.error("Ocorreu um erro inesperado.");
  } finally {
   setLoading(false);
  }
 };

 return (
  <>
   <Toaster richColors position="bottom-center" />
   <div className="flex min-h-screen items-center justify-center bg-gray-100">
    <Card className="w-full max-w-sm">
     <CardHeader className="text-center">
      <CardTitle>Acesso ao Sistema</CardTitle>
      <CardDescription>
       Use seu e-mail e senha para entrar.
      </CardDescription>
     </CardHeader>
     <CardContent>
      <form onSubmit={handleSubmit} className="space-y-4">
       <Input
        id="email"
        name="email"
        type="email"
        placeholder="seu.email@exemplo.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={loading}
       />
       <Input
        id="password"
        name="password"
        type="password"
        placeholder="Sua senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={loading}
       />
       <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? "Entrando..." : "Entrar"}
       </Button>
      </form>
     </CardContent>
    </Card>
   </div>
  </>
 );
}