import { useState } from "react";
import Navbar from "../Navbar";

export default function NavbarExample() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  return (
    <div>
      <Navbar
        isLoggedIn={isLoggedIn}
        username="Arun Kumar"
        onLogin={() => {
          setIsLoggedIn(true);
          console.log("Login clicked");
        }}
        onLogout={() => {
          setIsLoggedIn(false);
          console.log("Logout clicked");
        }}
      />
      <div className="p-6">
        <p className="text-muted-foreground">
          Navbar example - Try the mobile menu and navigation
        </p>
      </div>
    </div>
  );
}
