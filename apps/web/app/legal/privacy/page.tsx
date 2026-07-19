import { LegalDocument } from "@/components/ibis/legal/legal-document";
import { PRIVACY_SECTIONS } from "@/lib/legal/documents";

// Politique de confidentialité — page publique exigée par l'écran de consentement OAuth
// Google (champ « Lien vers les règles de confidentialité »). L'URL /legal/privacy est
// stable et déclarée dans la Google Cloud Console : ne pas la renommer.
export const metadata = {
  title: "Confidentialité — IBIS-X"
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      namespace="legal.privacy"
      sections={PRIVACY_SECTIONS}
      sibling={{ href: "/legal/terms", labelKey: "readTerms" }}
    />
  );
}
