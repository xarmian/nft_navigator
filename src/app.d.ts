// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			//supabase: SupabaseClient
			//safeGetSession(): Promise<{ session: Session | null; user: User | null }>
			ipAddress: string;
		}
		interface PageData {
			session: Session | null
			user: User | null
		}
		// interface Error {}
		// interface Platform {}
	}
}

export {};
