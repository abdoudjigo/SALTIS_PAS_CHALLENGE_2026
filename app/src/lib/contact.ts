// Adresse de contact protégée des robots ramasseurs d'adresses : codée au build (vite.config.ts),
// absente du HTML et du JavaScript en clair, reconstituée seulement quand le visiteur la demande.
export function adresseContact(): string {
  if (!__CONTACT_CODE__) return ''
  const octets = Uint8Array.from(atob(__CONTACT_CODE__), (c) => c.charCodeAt(0))
  return [...new TextDecoder().decode(octets)].reverse().join('')
}
