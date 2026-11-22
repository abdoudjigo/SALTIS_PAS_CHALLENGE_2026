import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, sys
S=sys.argv[1]
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":9,"axes.spines.top":False,"axes.spines.right":False,"axes.edgecolor":"#888","axes.labelcolor":"#333","xtick.color":"#444","ytick.color":"#444"})
VERT="#1f4d36"; GRIS="#b9b4a8"; OR="#e9a53a"; ROUGE="#b5432f"
# 1. Pluie : RMSE test
n=["Pluie de l'année précédente","Moyenne de tout le passé","Normale 1991-2020","Réseau de neurones","k plus proches voisins","Gradient boosting","XGBoost","Moyenne des 15 dernières saisons","Forêt aléatoire","Linéaire régularisé (retenu)"]
v=[167.6,132.9,121.8,140.1,121.2,119.0,118.3,117.9,117.2,111.1]
ref=[1,1,1,0,0,0,0,1,0,0]
o=sorted(range(len(v)),key=lambda k:-v[k])
fig,ax=plt.subplots(figsize=(7.2,2.3),dpi=200)
c=[GRIS if ref[k] else ("#5d8a73") for k in o]; c[-1]=VERT
b=ax.barh([n[k] for k in o],[v[k] for k in o],color=c,height=.68)
for r,k in zip(b,o): ax.text(r.get_width()+1.5,r.get_y()+r.get_height()/2,f"{v[k]:.0f}",va="center",fontsize=8)
ax.set_xlabel("RMSE sur le test 2016-2025 (mm, plus bas = meilleur)"); ax.set_xlim(0,260)
ax.tick_params(axis="y",labelsize=7.2)
from matplotlib.patches import Patch
ax.legend(handles=[Patch(color=GRIS,label="Prévision de référence"),Patch(color="#5d8a73",label="Famille de modèles"),Patch(color=VERT,label="Modèle retenu")],loc="lower right",bbox_to_anchor=(1.0,0.0),fontsize=7,frameon=True,facecolor="white",edgecolor="none")
plt.tight_layout(); plt.savefig(f"{S}/img/fig_pluie.png"); plt.close()
# 2. M3 alerte : BSS test par moment/culture
mom=["Fin mai","Fin juin","Fin juillet","Fin août"]
data={"Arachide":[.054,.03,.058,.101],"Mil":[-.038,-.061,-.002,.019],"Sorgho":[-.011,-.047,-.037,-.004],"Niébé":[.017,-.029,-.031,-.009],"Maïs":[-.066,-.079,-.017,.01]}
fig,ax=plt.subplots(figsize=(3.9,2.25),dpi=240)
import numpy as np
x=np.arange(4); w=.16; cols=[OR,"#6b8f7a","#8c6d4f","#5b7fa6","#a4a09a"]
for j,(k,vals) in enumerate(data.items()):
    ax.bar(x+(j-2)*w,vals,w,label=k,color=cols[j])
ax.axhline(0,color="#333",lw=.8); ax.axhline(.02,color=ROUGE,lw=.8,ls="--",label="Seuil « fiable »")
ax.set_xticks(x,mom); ax.set_ylabel("Gain sur la référence\n(Brier skill score)")
ax.legend(ncol=3,fontsize=6.5,frameon=False,loc="lower center",bbox_to_anchor=(.5,-.5))
plt.tight_layout(); plt.savefig(f"{S}/img/fig_alerte.png"); plt.close()
# 3. AgroDistrib : Gini vs valeur indicative
m=[("Prorata du besoin",0,0,GRIS,(-4,-19)),("Parts égales plafonnées",.45,14.8,"#8c6d4f",(6,-3)),("Pondéré vulnérabilité",.12,-4.2,"#5b7fa6",(8,-2)),("Pondéré valeur",.11,6.4,"#6b8f7a",(8,0)),("Multicritère (retenu)",.06,.6,VERT,(30,32)),("Priorité stricte",.59,60.9,ROUGE,(-62,-3)),("Optimisation linéaire",.39,26.4,OR,(6,-3))]
fig,ax=plt.subplots(figsize=(3.6,2.7),dpi=240)
for nm,g,val,cc,off in m:
    ax.scatter(g,val,s=40 if "retenu" not in nm else 95,color=cc,zorder=3,edgecolor="white")
    ax.annotate(nm,(g,val),xytext=off,textcoords="offset points",arrowprops=dict(arrowstyle="-",color=VERT,lw=.7) if "retenu" in nm else None,fontsize=7,fontweight="bold" if "retenu" in nm else "normal",color=VERT if "retenu" in nm else "#333")
ax.axhline(0,color="#ccc",lw=.6,zorder=0)
ax.set_xlabel("Inégalité de couverture (Gini)"); ax.set_ylabel("Valeur indicative\nvs prorata (%)"); ax.set_xlim(-.03,.75); ax.set_ylim(-16,68)
plt.tight_layout(); plt.savefig(f"{S}/img/fig_agro.png"); plt.close()
