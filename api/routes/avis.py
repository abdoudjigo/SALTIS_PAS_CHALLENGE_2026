"""Avis des ONG (formulaire « Donner votre avis ») : envoyé à l'équipe par e-mail (SMTP), sans rien stocker."""
import logging
import smtplib
from datetime import datetime
from email.message import EmailMessage
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..erreurs import ErreurApi, reponses_erreurs
from ..securite import limiter

journal = logging.getLogger(__name__)
avis = APIRouter(prefix="/avis", tags=["Avis"])
MAX_CARACTERES = 2000
DELAI_SMTP_S = 15


class Avis(BaseModel):
    """Les champs du formulaire, tous facultatifs. Les alias sont les libellés envoyés par le front."""
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    organisation: str | None = Field(None, alias="Nom de l'organisation")
    type_organisation: str | None = Field(None, alias="Type d'organisation")
    regions: str | None = Field(None, alias="Régions où vous intervenez")
    etape_utile: str | None = Field(None, alias="L'étape la plus utile pour vous")
    cherche: str | None = Field(None, alias="Qu'avez-vous cherché sans le trouver ?")
    prochaine_campagne: str | None = Field(None, alias="L'utiliseriez-vous pour votre prochaine campagne ?")
    probleme: str | None = Field(None, alias="Un problème rencontré ?")
    annee: str | None = None
    etape: str | None = None
    honey: str | None = Field(None, alias="_honey")

    @field_validator("*", mode="before")
    @classmethod
    def couper(cls, v):
        """Tout devient du texte coupé à 2 000 caractères ; un champ vide devient None."""
        if v is None:
            return None
        texte = str(v).strip()[:MAX_CARACTERES]
        return texte or None


LIBELLES = [(f.alias or nom, nom) for nom, f in Avis.model_fields.items() if nom not in {"annee", "etape", "honey"}]


def _message(a: Avis, expediteur: str, destinataire: str) -> EmailMessage:
    m = EmailMessage()
    m["Subject"] = f"Avis ONG – {a.organisation or 'sans nom'} – Assaman & Suuf"
    m["From"], m["To"] = expediteur, destinataire
    lignes = [f"{libelle} : {getattr(a, nom) or '—'}" for libelle, nom in LIBELLES]
    lignes += ["", f"Reçu le : {datetime.now(ZoneInfo('Africa/Dakar')):%d/%m/%Y à %H:%M} (heure de Dakar)",
               f"Année ouverte : {a.annee or '—'}", f"Étape ouverte : {a.etape or '—'}"]
    m.set_content("\n".join(lignes))
    return m


def _envoyer(p, m: EmailMessage) -> None:
    with smtplib.SMTP(p.smtp_host, p.smtp_port, timeout=DELAI_SMTP_S) as smtp:
        smtp.starttls()
        smtp.login(p.smtp_user, p.smtp_password.get_secret_value())
        smtp.send_message(m)


@avis.post("", summary="Envoyer un avis d'ONG", responses=reponses_erreurs(429, 502, 503))
async def envoyer_avis(corps: Avis, request: Request) -> dict:
    """Envoie l'avis à l'équipe par e-mail. Rien n'est enregistré. Un champ piège (`_honey`) rempli : réponse 200 sans envoi."""
    limiter(request, "avis")
    if corps.honey:
        return {"envoye": True}
    p = request.app.state.parametres
    if not (p.smtp_host and p.smtp_user and p.smtp_password.get_secret_value() and p.avis_destinataire):
        raise ErreurApi(503, "envoi_indisponible", "Envoi indisponible pour le moment.")
    try:
        await run_in_threadpool(_envoyer, p, _message(corps, p.smtp_user, p.avis_destinataire))
    except Exception:  # noqa: BLE001 — le détail (et jamais le mot de passe) reste dans le journal du serveur
        journal.exception("Échec de l'envoi d'un avis ONG par SMTP")
        raise ErreurApi(502, "envoi_echoue", "L'envoi n'a pas abouti.") from None
    return {"envoye": True}
