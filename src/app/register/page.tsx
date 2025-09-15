"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast, Toaster } from "sonner";
import Link from "next/link";

export default function RegisterPage() {
 const [name, setName] = useState("");
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [invitationCode, setInvitationCode] = useState("");
 const [loading, setLoading] = useState(false);
 const router = useRouter();

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  try {
   const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
     'Content-Type': 'application/json',
    },
    body: JSON.stringify({
     name,
     email,
     password,
     invitationCode,
    }),
   });

   const data = await response.json();

   if (!response.ok) {
    throw new Error(data.message || 'Falha ao registar.');
   }

   toast.success("Registo bem-sucedido!", {
    description: "Será redirecionado para a página de login.",
   });

   setTimeout(() => {
    router.push("/login");
   }, 2000);

  } catch (error: any) {
   toast.error("Erro no Registo", {
    description: error.message,
   });
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
      <CardTitle>Criar Conta</CardTitle>
      <CardDescription>
       Preencha os seus dados e o código de convite.
      </CardDescription>
     </CardHeader>
     <CardContent>
      <form onSubmit={handleSubmit} className="space-y-4">
       <Input
        id="name"
        name="name"
        type="text"
        placeholder="Nome completo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        disabled={loading}
       />
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
        placeholder="Crie uma senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={loading}
       />
       <Input
        id="invitationCode"
        name="invitationCode"
        type="text"
        placeholder="Código de Convite"
        value={invitationCode}
        onChange={(e) => setInvitationCode(e.target.value)}
        required
        disabled={loading}
       />
       <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? "A verificar..." : "Registar"}
       </Button>
      </form>
      <div className="mt-4 text-center text-sm">
       <Link href="/login" className="text-gray-600 hover:text-gray-900 flex items-center justify-center">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para o Login
       </Link>
      </div>
     </CardContent>
    </Card>
   </div>
  </>
 );
}