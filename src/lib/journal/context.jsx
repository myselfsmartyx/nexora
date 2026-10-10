import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { hashColor } from './constants.js'
import { fetchFolders, fetchOverview, fetchTagStats } from './data.js'
import { bindUser, loadVault } from './vault.js'
import VaultHost from '../../components/journal/VaultSheets.jsx'
import UpgradeSheet from '../../components/journal/UpgradeSheet.jsx'

const Ctx = createContext(null)
export const useJournal = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useJournal must be used inside <JournalProvider>')
  return c
}

export function JournalProvider({ session, children }) {
  const userId = session.user.id
  const navigate = useNavigate()
  const [isPro, setIsPro] = useState(false)
  const [planReady, setPlanReady] = useState(false)
  const [folders, setFolders] = useState([])
  const [tags, setTags] = useState([])
  const [overview, setOverview] = useState(null)
  const [metaReady, setMetaReady] = useState(false)
  const [upgrade, setUpgrade] = useState(null)
  const [dataVersion, setDataVersion] = useState(0)

  const reloadMeta = useCallback(async (which = ['folders', 'tags', 'overview']) => {
    const jobs = []
    if (which.includes('folders')) jobs.push(fetchFolders().then(setFolders))
    if (which.includes('tags')) jobs.push(fetchTagStats().then(setTags))
    if (which.includes('overview')) jobs.push(fetchOverview().then(setOverview))
    await Promise.allSettled(jobs)
    setMetaReady(true)
  }, [])

  // Call after any entry create / edit / delete / move so lists and counters refresh.
  const touchData = useCallback((which) => {
    setDataVersion((v) => v + 1)
    return reloadMeta(which)
  }, [reloadMeta])

  useEffect(() => {
    bindUser(userId)
    loadVault(userId).catch(() => {})
    reloadMeta()
    let cancelled = false
    supabase.from('subscriptions').select('plan_tier,is_active').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setIsPro(!!data?.is_active && !!data?.plan_tier && data.plan_tier !== 'free')
        setPlanReady(true)
      })
      .catch(() => setPlanReady(true))
    return () => { cancelled = true }
  }, [userId, reloadMeta])

  const tagColors = useMemo(() => new Map(tags.map((t) => [t.tag, t.color])), [tags])
  const tagColor = useCallback((name) => tagColors.get(name) || hashColor(name), [tagColors])
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders])

  const value = useMemo(() => ({
    userId, isPro, planReady, folders, folderById, tags, tagColor, overview, metaReady,
    reloadMeta, touchData, dataVersion,
    openUpgrade: (reason = 'general') => setUpgrade(reason),
  }), [userId, isPro, planReady, folders, folderById, tags, tagColor, overview, metaReady, reloadMeta, touchData, dataVersion])

  return (
    <Ctx.Provider value={value}>
      {children}
      <VaultHost />
      <UpgradeSheet reason={upgrade} onClose={() => setUpgrade(null)} onUpgrade={() => { const r = upgrade || 'general'; setUpgrade(null); navigate(`/upgrade?reason=${encodeURIComponent(r)}`) }} />
    </Ctx.Provider>
  )
}
