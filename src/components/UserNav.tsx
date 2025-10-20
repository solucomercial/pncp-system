// src/components/UserNav.tsx
"use client";

import { signOut, useSession } from "next-auth/react";
// Link e BookText foram removidos das importações
import { LogOut, MoreVertical } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 // DropdownMenuSeparator foi removido das importações
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "./ui/button";

export function UserNav() {
 const { data: session } = useSession();

 if (!session?.user) {
  return null;
 }

 const { name, email, image } = session.user;

 const getInitials = (name?: string | null, email?: string | null) => {
  if (name) {
   const parts = name.split(' ');
   if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
   }
   return name.substring(0, 2).toUpperCase();
  }
  return email?.substring(0, 2).toUpperCase() || 'U';
 }

 const initials = getInitials(name, email);

 return (
  <DropdownMenu>
   <DropdownMenuTrigger asChild>
    <Button variant="ghost" className="relative h-8 w-8 rounded-full sm:w-full sm:max-w-[200px] sm:justify-start sm:rounded-md sm:p-2 sm:gap-3">
     <Avatar className="h-8 w-8">
      <AvatarImage src={image ?? ""} alt={name ?? email ?? ""} />
      <AvatarFallback>{initials}</AvatarFallback>
     </Avatar>
     <div className="hidden sm:grid flex-1 text-left text-sm leading-tight">
      <p className="text-sm font-medium leading-tight truncate">
       {name ?? email}
      </p>
      {name && (
       <p className="text-xs leading-tight text-muted-foreground truncate">
        {email}
       </p>
      )}
     </div>
     <MoreVertical className="hidden sm:block h-4 w-4 text-muted-foreground ml-auto" />
    </Button>
   </DropdownMenuTrigger>
   <DropdownMenuContent className="w-50" align="start">
    {/* O item de menu da documentação e o separador foram removidos */}
    <DropdownMenuItem onSelect={() => signOut({ callbackUrl: '/login' })}>
     <LogOut className="mr-2 h-4 w-4" />
     <span>Sair</span>
    </DropdownMenuItem>
   </DropdownMenuContent>
  </DropdownMenu>
 );
}