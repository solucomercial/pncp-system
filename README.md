# PNCP System

Sistema para consulta, análise e gestão de licitações e contratos públicos utilizando dados do Portal Nacional de Contratações Públicas (PNCP).

## Visão Geral

Este projeto é uma aplicação web desenvolvida em Next.js e TypeScript, com foco em facilitar buscas inteligentes, análise e visualização de licitações e contratos públicos. Ele integra autenticação, filtros avançados, geração de relatórios e interface moderna.

## Principais Funcionalidades

- Busca de licitações e contratos no PNCP com filtros avançados.
- Autenticação de usuários (NextAuth).
- Geração de relatórios customizados.
- Interface responsiva e moderna com componentes reutilizáveis.
- Cache e otimização de requisições à API do PNCP.

## Estrutura de Pastas

```
src/
  app/                # Páginas e rotas da aplicação (Next.js)
	 api/              # Rotas de API (Next.js API routes)
	 login/            # Páginas de login, erro e verificação
	 register/         # Página de registro de usuário
  components/         # Componentes reutilizáveis de UI
  lib/                # Funções utilitárias, integração com API, autenticação, cache, tipos
```

## Principais Arquivos

- `src/app/page.tsx` — Página principal de busca e exibição de resultados.
- `src/app/api/buscar-licitacoes/route.tsx` — Rota de API para busca de licitações.
- `src/lib/comprasApi.ts` — Funções para integração com a API do PNCP.
- `src/lib/types.ts` — Tipos TypeScript para dados de licitações e contratos.
- `src/components/ui/` — Componentes de interface (botão, card, badge, etc).

## Instalação

1. **Clone o repositório:**
	```bash
	git clone https://github.com/seu-usuario/pncp-system.git
	cd pncp-system
	```

2. **Instale as dependências:**
	```bash
	npm install
	# ou
	yarn install
	```

3. **Configure as variáveis de ambiente:**
	- Crie um arquivo `.env.local` com as variáveis necessárias (exemplo: chaves de API, segredos de autenticação).

4. **Rode o projeto em modo desenvolvimento:**
	```bash
	npm run dev
	# ou
	yarn dev
	```

5. **Acesse em:**  
	[http://localhost:3000](http://localhost:3000)

## Scripts

- `dev` — Inicia o servidor de desenvolvimento.
- `build` — Gera a build de produção.
- `start` — Inicia o servidor em produção.

## Tecnologias Utilizadas

- [Next.js](https://nextjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [NextAuth.js](https://next-auth.js.org/)
- [PNCP API](https://www.gov.br/pncp/pt-br)

## Contribuição

1. Fork este repositório.
2. Crie uma branch: `git checkout -b minha-feature`.
3. Faça suas alterações e commit: `git commit -m 'Minha feature'`.
4. Envie para o seu fork: `git push origin minha-feature`.
5. Abra um Pull Request.

## Licença

Este projeto está sob a licença MIT.
