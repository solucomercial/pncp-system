// src/app/docs/page.tsx
"use client"; // **A CORREÇÃO:** Garante que o componente rode no navegador

import React, { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Skeleton } from '@/components/ui/skeleton';

const SwaggerDocs = () => {
  const [spec, setSpec] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/docs')
      .then(res => {
        if (!res.ok) {
          throw new Error(`Falha ao buscar a documentação da API (status: ${res.status})`);
        }
        return res.json();
      })
      .then(data => {
        setSpec(data);
      })
      .catch(err => {
        console.error("Erro ao buscar a especificação do Swagger:", err);
        setError(err.message);
      });
  }, []);

  if (error) {
    return (
      <div className="p-4 rounded-md border border-destructive/50 bg-destructive/10 text-red-700">
        <h2 className="font-bold">Erro ao carregar a documentação</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-12 w-1/3 rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  // Garante que SwaggerUI só seja renderizado no cliente
  return typeof window !== 'undefined' ? <SwaggerUI spec={spec} /> : null;
};

export default function ApiDocPage() {
  return (
    <section className="container mx-auto py-8">
      <SwaggerDocs />
    </section>
  );
}