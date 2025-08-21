"use client"

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
 const router = useRouter();

 return (
  <div className="flex min-h-screen items-center justify-center bg-gray-100">
   <Card className="w-full max-w-sm text-center">
    <CardHeader>
     <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
     <CardTitle className="mt-4">Acesso Negado</CardTitle>
     <CardDescription className="mt-2">
      Seu e-mail não tem permissão para acessar este sistema. Por favor, entre em contato com o administrador.
     </CardDescription>
     <Button onClick={() => router.push('/login')} className="mt-4">
      Tentar Novamente
     </Button>
    </CardHeader>
   </Card>
  </div>
 );
}