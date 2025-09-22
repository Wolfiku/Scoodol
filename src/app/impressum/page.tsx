
import LegalLayout from "@/app/components/legal-layout";

export default function ImpressumPage() {
    return (
        <LegalLayout title="Impressum">
            <h2>Angaben gemäß § 5 TMG</h2>
            <p>
                Wolfgang Frieder Kupfer<br/>
                Albert-Lux-Straße 5<br/>
                91171 Greding<br/>
                Deutschland
            </p>

            <h2>Kontakt</h2>
            <p>
                Telefon: +49 177 2841778<br/>
                E-Mail: kontakt@scoodol.de
            </p>
        </LegalLayout>
    );
}
