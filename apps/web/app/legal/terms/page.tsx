import { LegalDocument } from "@/components/ibis/legal/legal-document";
import { TERMS_SECTIONS } from "@/lib/legal/documents";

// Conditions générales d'utilisation — page publique exigée par l'écran de consentement
// OAuth Google (champ « Lien vers les conditions d'utilisation »). L'URL /legal/terms est
// stable et déclarée dans la Google Cloud Console : ne pas la renommer.
export const metadata = {
  title: "Conditions d'utilisation — IBIS-X"
};

export default function TermsPage() {
  return (
    <LegalDocument
      namespace="legal.terms"
      sections={TERMS_SECTIONS}
      sibling={{ href: "/legal/privacy", labelKey: "readPrivacy" }}
    />
  );
}
