"""Proposer une répartition AgroDistrib depuis la ligne de commande.

Lancer depuis la racine du dépôt, par exemple (cas de démonstration de ml/README.md) :
    venv/bin/python -m ml.agrodistrib.repartir --intrant NPK_15_15_15 --culture "MIL (SOUNA)" \
        --stock 20000 --niveau ZONE --campagne 2026

Avec une dose saisie pour une culture qui n'en a pas (unité de l'intrant, ici kg/ha) :
    venv/bin/python -m ml.agrodistrib.repartir --intrant NPK_15_15_15 --culture ARACHIDE \
        --dose ARACHIDE=150 --stock 20000 --niveau REGION

Lit MARTS.MART_TERRITOIRES_AGRODISTRIB (copie locale ml/donnees/, ou Snowflake la première fois).
Écrit ml/sorties/agrodistrib_scenarios.csv, agrodistrib_territoires.csv, agrodistrib_departements.csv
et agrodistrib_parametres.json (dernière demande). Rien n'est écrit dans Snowflake.
"""

import argparse
import json
from pathlib import Path

import pandas as pd

from ml.agrodistrib.moteur import ALPHA_DEFAUT, INTRANTS, NIVEAUX, proposer_scenarios
from ml.commun.donnees import lire

SORTIES = Path(__file__).resolve().parents[1] / "sorties"


def _dose(texte: str) -> tuple[str, float]:
    culture, sep, valeur = texte.rpartition("=")
    if not sep or not culture:
        raise argparse.ArgumentTypeError(f"format attendu CULTURE=DOSE, reçu {texte!r}")
    return culture, float(valeur.replace(",", "."))


def main(argv=None):
    p = argparse.ArgumentParser(description="Proposer une répartition du stock d'intrants (AgroDistrib).")
    p.add_argument("--intrant", required=True, choices=sorted(INTRANTS))
    p.add_argument("--culture", required=True, action="append", help="répéter pour plusieurs cultures")
    p.add_argument("--stock", required=True, type=float, help="stock à répartir, en tonnes")
    p.add_argument("--niveau", default="DEPARTEMENT", choices=list(NIVEAUX))
    p.add_argument("--alpha", default=ALPHA_DEFAUT, type=float, help="0 = équité seule, 1 = rendement seul")
    p.add_argument("--campagne", type=int)
    p.add_argument("--dose", action="append", type=_dose, default=[], help="CULTURE=DOSE, pour une culture sans dose")
    a = p.parse_args(argv)

    r = proposer_scenarios(lire("MART_TERRITOIRES_AGRODISTRIB"), a.intrant, a.culture, a.stock,
                           niveau=a.niveau, alpha=a.alpha, doses_saisies=dict(a.dose), campagne=a.campagne)

    SORTIES.mkdir(exist_ok=True)
    r.scenarios.to_csv(SORTIES / "agrodistrib_scenarios.csv", index=False)
    r.territoires.round(3).to_csv(SORTIES / "agrodistrib_territoires.csv", index=False)
    r.departements.round(3).to_csv(SORTIES / "agrodistrib_departements.csv", index=False)
    (SORTIES / "agrodistrib_parametres.json").write_text(json.dumps(r.parametres, ensure_ascii=False, indent=2))

    pd.set_option("display.width", 250, "display.max_columns", 30)
    print(json.dumps(r.parametres, ensure_ascii=False))
    print("\nScénarios (gains comparés au prorata du besoin) :")
    print(r.scenarios.set_index("scenario").T.to_string())
    choisi = r.territoires[r.territoires.scenario == r.scenarios.loc[r.scenarios.choisi_par_le_decideur, "scenario"].iloc[0]]
    print(f"\nScénario du décideur, par {a.niveau.lower()} :")
    print(choisi.drop(columns=["scenario"]).round(1).to_string(index=False))
    if not r.doses_a_saisir.empty:
        print(f"\n{len(r.doses_a_saisir)} couple(s) département × culture sans dose (non servis) : "
              f"saisir une dose avec --dose CULTURE=DOSE ({INTRANTS[a.intrant][2]}).")
    imputes = r.departements[r.departements.critere_impute.notna()].drop_duplicates(["code_departement", "culture"])
    for _, l in imputes.iterrows():
        print(f"Critère vide remplacé par la médiane : {l.departement} × {l.culture} ({l.critere_impute})")


if __name__ == "__main__":
    main()
