"""Assistant de la scène : aide, hors champ, bulletins de l'ANACIM, question libre (passage cité, puis modèle simulé)."""

from api.voix import bulletins, redaction
from api.voix.comprendre import comprendre, normaliser

from .test_previsions import client_ml  # noqa: F401 (fixture : marts + prévisions synthétiques)

V1 = "/api/v1/voix"
DEPARTEMENTS = {"SEN.7.1_1": "Kolda", "SEN.11.3_1": "Thiès", "SEN.5.2_1": "Kaolack"}


def test_base_des_bulletins():
    tous = bulletins.charger()
    assert len(tous) >= 50 and tous[0].debut == "2023-06-01"
    assert all(b.sommaire and b.sections for b in tous)
    assert [(b.annee, b.numero_decade_annee) for b in tous] == sorted((b.annee, b.numero_decade_annee) for b in tous)
    assert bulletins.choisir(2024, 8, 3).periode_fr == "du 21 au 31 août 2024"
    assert bulletins.choisir(2019) is None  # avant juin 2023 : aucun bulletin, rien d'inventé


def test_comprendre_conversation():
    i = comprendre("Salaam aleekum, naka nga def ?", DEPARTEMENTS)
    assert (i.fonctionnalite, i.politesse, i.salut) == ("aide", "ca_va", "Maalekum salaam")
    assert comprendre("Bonjour, qu'est-ce que tu sais faire ?", DEPARTEMENTS).politesse == "qui"
    assert comprendre("Ça va pleuvoir à Kolda ?", DEPARTEMENTS).fonctionnalite == "saison"  # « ça va » n'est pas une politesse ici
    assert comprendre("Que dit le dernier bulletin de l'ANACIM ?", DEPARTEMENTS).fonctionnalite == "bulletin"
    assert comprendre("La pluie en septembre 2025, deuxième décade", DEPARTEMENTS).fonctionnalite == "bulletin"
    # Hors du champ de la plateforme : ravageurs, élevage, fleuves, marchés
    for q in ("Y a-t-il des chenilles sur le mil ?", "Comment protéger mes moutons ?", "Le fleuve à Bakel en septembre 2025",
              "Le prix de l'arachide au marché"):
        assert comprendre(q, DEPARTEMENTS).fonctionnalite == "hors_champ", q
    assert comprendre("Combien d'engrais pour 1 hectare de mil à Kolda ?", DEPARTEMENTS).fonctionnalite == "besoins"
    assert comprendre("Pourquoi les feuilles jaunissent ?", DEPARTEMENTS).fonctionnalite == "libre"
    t = normaliser("Les pâturages en août 2024, première décade")
    assert (bulletins.trouver_theme(t), bulletins.trouver_mois(t), bulletins.trouver_decade(t)) == ("pastorale", 8, 1)


def test_bonnes_manieres(client_ml):  # noqa: F811
    def dire(texte):
        return client_ml.post(f"{V1}/texte", json={"texte": texte}).json()

    d = dire("Bonjour")
    assert d["fonctionnalite"] == "aide" and d["vue"]["mode"] is None and d["texte_wo"]
    assert d["texte_fr"].startswith("Bonjour, comment puis-je vous aider sur la saison")
    assert dire("Bonsoir")["texte_fr"].startswith("Bonsoir")
    salaam = dire("Salaam aleekum, naka nga def ?")
    assert salaam["texte_fr"].startswith("Maalekum salaam ! Je vais bien") and salaam["texte_wo"].startswith("Maalekum salaam")
    assert "Je vais bien" in dire("Ça va ?")["texte_fr"]
    assert "plaisir" in dire("merci")["texte_fr"] and "plaisir" in dire("Jërëjëf")["texte_fr"]
    assert "Au revoir" in dire("Bonne journée")["texte_fr"]
    assert "autre question" in dire("D'accord")["texte_fr"]
    assert "Quand semer" in dire("Qui es-tu ?")["texte_fr"]  # se présente, avec des exemples
    # Une vraie question précédée d'un salut : on rend le salut, puis on répond
    semis = dire("Bonjour, quand semer l'arachide ?")
    assert semis["fonctionnalite"] == "semis" and semis["texte_fr"].startswith("Bonjour ! ")


def test_texte_bulletin_dernier_et_date(client_ml):  # noqa: F811
    dernier = bulletins.charger()[-1]
    # L'année de l'écran (campagne à venir) ne filtre pas les bulletins
    d = client_ml.post(f"{V1}/texte", json={"texte": "Que dit le dernier bulletin ?", "annee": 2027}).json()
    assert d["fonctionnalite"] == "bulletin" and dernier.periode_fr in d["texte_fr"]
    assert d["sources"][0]["titre"].startswith("Bulletin agrométéorologique de l'ANACIM") and "extrait" not in d["sources"][0]
    d = client_ml.post(f"{V1}/texte", json={"texte": "La pluie en septembre 2025, deuxième décade"}).json()
    assert d["fonctionnalite"] == "bulletin" and "du 11 au 20 septembre 2025" in d["texte_fr"]
    d = client_ml.post(f"{V1}/texte", json={"texte": "Bulletin de l'ANACIM de mars 2019"}).json()
    assert "Pas de bulletin" in d["texte_fr"]


def test_hors_champ_ni_cite_ni_cherche(client_ml):  # noqa: F811
    """Ravageurs, élevage, fleuves, marchés : hors de la plateforme, même si les bulletins en parlent."""
    d = client_ml.post(f"{V1}/texte", json={"texte": "Y a-t-il des sauteriaux en août 2026 ?"}).json()
    assert d["fonctionnalite"] == "hors_champ" and "pas couvert" in d["texte_fr"] and not d["sources"] and d["texte_wo"]
    # Le résumé du dernier bulletin ne cite pas les sujets hors champ
    resume = client_ml.post(f"{V1}/texte", json={"texte": "Que dit le dernier bulletin ?"}).json()["texte_fr"].lower()
    assert not any(m in resume for m in ("hydrologie", "phytosanitaire", "sauteriau", "pastoral", "marché"))
    # Ni la recherche libre, ni les sections gardées n'en citent une phrase
    passages, *_ = bulletins._index()
    assert passages and not any(p.theme in bulletins.SECTIONS_HORS_CHAMP or bulletins.hors_champ(p.texte) for p in passages)


def test_question_libre_sans_ia_cite_le_passage(client_ml):  # noqa: F811
    d = client_ml.post(f"{V1}/texte", json={"texte": "Que faire pendant les phases sèches ?"}).json()
    assert d["fonctionnalite"] == "libre"
    assert "ANACIM" in d["texte_fr"] and d["redige_par_ia"] is False and d["sources"]
    rien = client_ml.post(f"{V1}/texte", json={"texte": "Qui a gagné la coupe du monde de football ?"}).json()
    assert rien["fonctionnalite"] == "libre" and "pas trouvé" in rien["texte_fr"] and not rien["sources"]


def test_question_libre_redigee_par_le_modele(client_ml, monkeypatch):  # noqa: F811
    vu = {}

    def faux(p, question, passages):
        vu["question"], vu["passages"] = question, passages
        return "Selon le bulletin, profitez des phases sèches pour épandre l'engrais."

    monkeypatch.setattr(redaction, "rediger", faux)
    monkeypatch.setattr(client_ml.app.state.parametres.llm_api_key, "get_secret_value", lambda: "cle-de-test")
    d = client_ml.post(f"{V1}/texte", json={"texte": "Que faire pendant les phases sèches ?"}).json()
    assert d["fonctionnalite"] == "libre"
    assert d["redige_par_ia"] is True and d["texte_fr"].startswith("Selon le bulletin")
    assert vu["passages"] and all("extrait" in x for x in vu["passages"])  # le modèle voit les passages, pas le front
    assert all("extrait" not in x for x in d["sources"])


def test_redaction_sans_cle_ne_fait_rien():
    class P:
        class llm_api_key:
            @staticmethod
            def get_secret_value():
                return ""
    assert redaction.rediger(P, "question", [{"titre": "t", "theme": "pluie", "extrait": "x"}]) is None
