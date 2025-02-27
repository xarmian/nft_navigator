import { json } from '@sveltejs/kit';
import { supabasePrivateClient } from '$lib/supabase-server';

export async function GET() {
    try {
        const { data, error } = await supabasePrivateClient.rpc('get_tweet_impressions');
        
        if (error) throw error;

        // Transform the data to match our needs
        const transformedData = data
            .filter(entry => entry.Project && entry.Project.trim().length > 0)
            .map(entry => ({
                username: entry['Author Username'],
                points: entry.total_views,
                lastActive: entry.latest_tweet_time,
                projectName: entry.Project
            }));

        return json(transformedData);
    } catch (error) {
        console.error('Error fetching tweet impressions:', error);
        return json({ error: 'Failed to fetch social data' }, { status: 500 });
    }
} 