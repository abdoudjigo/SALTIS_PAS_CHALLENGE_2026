// Fonds de carte (fichiers statiques du front) : contours des départements et des zones.
import { useQuery } from '@tanstack/react-query'
import { lireGeo, type Contours, type ContoursZones } from './geo'

export const useContours = () =>
  useQuery({ queryKey: ['geo-departements'], queryFn: () => lireGeo<Contours>('/geo/departements.geojson'), staleTime: Infinity, gcTime: Infinity })

export const useContoursZones = () =>
  useQuery({ queryKey: ['geo-zones'], queryFn: () => lireGeo<ContoursZones>('/geo/zones_agroecologiques.geojson'), staleTime: Infinity, gcTime: Infinity })
