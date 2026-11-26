import { createContext } from 'react'

/** Le département choisi sur la carte (fourni par la scène) : la barre repliée du tableau de bord signale qu'il a changé. */
export const SignalTableau = createContext<string | null>(null)
