import { NextResponse, type NextRequest } from "next/server";

// La racine renvoie vers l'app ; la garde côté client redirige ensuite vers
// /login si aucune session. (La landing publique arrive au J7.)
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL("/dashboard", request.url));
}

export const config = {
  matcher: ["/"]
};
