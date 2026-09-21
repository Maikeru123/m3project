"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, LayoutDashboard, Menu, Search, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets Inquiry", icon: Search },
]

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const nav = (
    <>
      <Link href="/dashboard" className="mb-8 flex items-center gap-3 px-2" onClick={() => setOpen(false)}>
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-white"><Building2 className="size-5" /></span>
        <span className="leading-tight text-foreground"><strong className="block text-base">NGOBIA</strong><span className="text-[10px] text-muted-foreground">National Government-Owned<br />Buildings Inventory Application</span></span>
      </Link>
      <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Main menu</p>
      <nav className="space-y-1">
        {navigation.map(({ href, label, icon: Icon }) => {
          const selected = pathname === href
          return <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="size-4" />{label}</Link>
        })}
      </nav>
      <div className="mt-auto border-t pt-4">
        <p className="px-3 text-xs font-medium">Government Asset Registry</p>
        <p className="mt-1 px-3 text-[11px] text-muted-foreground">Academic demonstration system</p>
      </div>
    </>
  )

  return <div className="app-shell min-h-svh">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background p-4 md:flex">{nav}</aside>
    {open && <div className="fixed inset-0 z-40 md:hidden"><button aria-label="Close navigation" className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} /><aside className="relative flex h-full w-72 flex-col bg-background p-4 shadow-xl"> <Button aria-label="Close navigation" variant="ghost" size="icon" className="absolute right-3 top-3" onClick={() => setOpen(false)}><X /></Button>{nav}</aside></div>}
    <div className="md:pl-64">
      <header className="flex h-16 items-center justify-between border-b bg-background px-4 sm:px-7">
        <div className="flex items-center gap-3"><Button className="md:hidden" variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu /></Button><h1 className="text-base font-semibold sm:text-lg">{title}</h1></div>
        <span className="hidden text-xs font-medium text-muted-foreground sm:block">National Government-Owned Buildings Inventory</span>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-7">{children}</main>
    </div>
  </div>
}
