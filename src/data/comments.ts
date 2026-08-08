import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { DEMO, demoComments, demoDeleteComment, demoSaveComment } from './demo'

/**
 * Comments on the club's news — the first thing in this app a member writes for the
 * other members to read.
 *
 * Lukas's wishlist, 2026-08-08: *"Kan kommenterer på nyheder."*
 *
 * **The names are not stored.** A comment carries `author_id` and nothing else about
 * who wrote it, and the name is resolved against `user_member_mapping` when it is
 * drawn. The alternative — a `author` text column, as `news` itself has — writes the
 * name into every row at the moment of writing, so a member who is renamed is
 * renamed on his future comments and not his past ones. The club's own news table
 * has exactly that problem today; there was no reason to repeat it.
 *
 * That mapping is readable by every member since this morning (`member_visits`,
 * "sidst set"), which is what makes this a lookup rather than a schema change.
 */
export type Comment = {
  id: string
  news_id: string
  author_id: string
  body: string
  created_at: string
}

const COLUMNS = 'id, news_id, author_id, body, created_at'

/**
 * Every comment the reader may see, grouped by the item it hangs under.
 *
 * One query rather than one per news item. The page draws eight cards; eight
 * round trips to fetch what is usually a handful of rows would make the threads
 * arrive one after another down the screen. RLS has already narrowed this to
 * published items, so "everything I may read" is a small set by construction.
 */
export function useComments() {
  return useQuery({
    queryKey: ['news-comments'],
    queryFn: async (): Promise<Record<string, Comment[]>> => {
      const rows = DEMO
        ? [...demoComments]
        : await (async () => {
            const { data, error } = await supabase()
              .from('news_comments')
              .select(COLUMNS)
              .order('created_at', { ascending: true })
            if (error) throw error
            return (data ?? []) as Comment[]
          })()

      const out: Record<string, Comment[]> = {}
      for (const row of rows) (out[row.news_id] ??= []).push(row)
      return out
    },
  })
}

/**
 * account id → the club's name for it.
 *
 * Its own query rather than a join, matching how `lastSeen` reads the same table:
 * there is no foreign key between `auth.users` and anything member-shaped, because
 * the account is the only identity the database can verify. An id with no mapping
 * gets no name — see the component, which says so rather than inventing one.
 */
export function useMemberNames() {
  return useQuery({
    queryKey: ['member-names'],
    queryFn: async (): Promise<Record<string, string>> => {
      // The demo signs in as `demo-user`; `demo-2` is the other voice in its one
      // thread, so the demo shows a comment you may change beside one you may not.
      if (DEMO) return { 'demo-user': 'Lukas', 'demo-2': 'Saaby' }
      const { data, error } = await supabase()
        .from('user_member_mapping')
        .select('user_id, member_name')
      if (error) throw error
      const out: Record<string, string> = {}
      for (const r of (data ?? []) as { user_id: string; member_name: string }[]) {
        out[r.user_id] = r.member_name
      }
      return out
    },
  })
}

/**
 * Write one comment. **Insert only — a comment cannot be edited by anybody.**
 *
 * Lukas, 2026-08-08: *"man behøver ikke at kunne rette i egne kommentarer."* So
 * there is no update branch here, and there is no UPDATE policy on the table for
 * one to reach: a member who mistypes deletes and writes again. See
 * `20260808153000_news_comments_no_edit.sql` for what that bought.
 *
 * `author_id` is sent, and the policy requires it to be `auth.uid()` — so this is
 * the client agreeing with the rule rather than choosing.
 */
export function useSaveComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: { news_id: string; author_id: string; body: string }) => {
      const body = c.body.trim()
      if (DEMO) return demoSaveComment({ ...c, body })
      const { error } = await supabase()
        .from('news_comments')
        .insert({ news_id: c.news_id, author_id: c.author_id, body })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['news-comments'] }),
  })
}

/** Remove one. There is no undo — see the confirmation this is wired to. */
export function useDeleteComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (DEMO) return demoDeleteComment(id)
      const { error } = await supabase().from('news_comments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['news-comments'] }),
  })
}
