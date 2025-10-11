import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link, useLocation } from "wouter";
import { Home, BookOpen, Award, Crown, Settings, LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavbarProps {
  isLoggedIn?: boolean;
  username?: string;
  onLogin?: () => void;
  onLogout?: () => void;
}

export default function Navbar({
  isLoggedIn = false,
  username = "Guest",
  onLogin,
  onLogout,
}: NavbarProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: Home },
    { path: "/lessons", label: "Lessons", icon: BookOpen },
    { path: "/rewards", label: "Rewards", icon: Award },
    { path: "/premium", label: "Premium", icon: Crown },
  ];

  const initials = username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {navItems.map((item) => (
        <Link
          key={item.path}
          href={item.path}
          onClick={() => mobile && setMobileOpen(false)}
        >
          <Button
            variant="ghost"
            className={cn(
              "hover-elevate",
              location === item.path && "bg-primary/10 text-primary",
              mobile && "w-full justify-start"
            )}
            data-testid={`nav-link-${item.label.toLowerCase()}`}
          >
            <item.icon className="w-4 h-4 mr-2" />
            {item.label}
          </Button>
        </Link>
      ))}
    </>
  );

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer" data-testid="nav-logo">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center">
              <span className="text-white font-bold">FJ</span>
            </div>
            <span className="font-bold text-xl hidden sm:inline">
              FluencyJet
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          <NavLinks />
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                onClick={onLogout}
                data-testid="button-logout"
                className="hidden md:inline-flex hover-elevate"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button onClick={onLogin} data-testid="button-login" className="hidden md:inline-flex">
              Login
            </Button>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden hover-elevate" data-testid="button-menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="flex flex-col gap-4 mt-8">
                <NavLinks mobile />
                <div className="border-t pt-4 mt-4">
                  {isLoggedIn ? (
                    <Button
                      variant="ghost"
                      onClick={onLogout}
                      className="w-full justify-start hover-elevate"
                      data-testid="button-logout-mobile"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  ) : (
                    <Button onClick={onLogin} className="w-full" data-testid="button-login-mobile">
                      Login
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
