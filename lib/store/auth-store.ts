import { create } from 'zustand'
import { invoke } from '@/lib/tauri-invoke'
import CryptoJS from 'crypto-js'

const SECRET = process.env.NEXT_PUBLIC_ENCRYPTION_SECRET || 'cuidar-erp-2026-s3cr3t-k3y'

interface User {
  id: number
  username: string
  role: string
}

interface Creche {
  id: number | null
  nome: string
  cnpj: string | null
  endereco: string
  numero: string | null
  bairro: string | null
  cidade: string
  estado: string
  telefone: string | null
  email: string | null
  senha_admin?: string | null
  onboarding_completo: boolean
  valor_padrao_mensalidade?: number
  dia_vencimento?: number
  taxa_matricula?: number
}

interface AuthState {
  user: User | null
  creche: Creche | null
  isLoading: boolean
  logoBase64: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  init: () => Promise<void>
  setCreche: (creche: Creche) => void
  setUser: (user: User) => void
  setLogo: (logo: string | null) => void
  resetAuth: () => void
  resetAll: () => void
}

const STORAGE_KEY = 'cuidar_erp_user'

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const decrypted = CryptoJS.AES.decrypt(raw, SECRET).toString(CryptoJS.enc.Utf8)
    if (!decrypted) return null
    return JSON.parse(decrypted) as User
  } catch {
    return null
  }
}

function saveUser(user: User | null) {
  if (user) {
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(user), SECRET).toString()
    localStorage.setItem(STORAGE_KEY, encrypted)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadUser(),
  creche: null,
  isLoading: false,
  logoBase64: null,

  init: async () => {
    const user = loadUser()
    set({ user })
    if (user) {
      try {
        const [creche, logo] = await Promise.all([
          invoke<Creche>('get_creche'),
          invoke<string | null>('get_logo'),
        ])
        set({ creche, logoBase64: logo })
      } catch (err) {
        if (String(err).includes('Não autenticado')) {
          localStorage.removeItem(STORAGE_KEY)
          set({ user: null, creche: null, isLoading: false })
        } else set({ creche: null })
      }
    }
  },

  login: async (username: string, password: string) => {
    set({ isLoading: true })
    try {
      const user = await invoke<User>('login', { username, password })
      saveUser(user)
      set({ user, isLoading: false })
      return true
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  logout: async () => {
    try {
      await invoke('logout')
    } catch {
    }
    saveUser(null)
    set({ user: null, creche: null })
  },

  setCreche: (creche: Creche) => {
    set({ creche })
  },

  setUser: (user: User) => {
    saveUser(user)
    set({ user })
  },

  setLogo: (logo: string | null) => {
    set({ logoBase64: logo })
  },

  resetAuth: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ user: null, creche: null, isLoading: false })
  },

  resetAll: () => {
    localStorage.clear()
    sessionStorage.setItem('cuidar_erp_reset', 'true')
    set({ user: null, creche: null, isLoading: false })
    setTimeout(() => {
      window.location.href = '/login'
    }, 300)
  },
}))
