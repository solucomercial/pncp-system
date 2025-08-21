import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function VerifyRequestPage() {
 return (
  <div className="flex min-h-screen items-center justify-center bg-gray-100">
   <Card className="w-full max-w-sm text-center">
    <CardHeader>
     <CardTitle>Verifique seu E-mail</CardTitle>
     <CardDescription>
      Um link de acesso foi enviado para a sua caixa de entrada.
     </CardDescription>
    </CardHeader>
   </Card>
  </div>
 );
}