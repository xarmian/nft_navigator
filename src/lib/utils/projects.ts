import { supabasePublicClient } from '$lib/supabase';

export interface IProject {
    id: number;
    title: string;
    description: string;
    category: string;
    type: string;
    url?: string;
    galxe?: string;
    guide?: string;
    twitter?: string;
    quests: IQuest[];
    tracking?: boolean;
    realtime?: boolean;
    status?: string; // 'active' or 'inactive'
    logo?: string;
    new?: boolean;
}

export type IQuest = {
    id: number;
    name?: string;
    title: string;
    description: string;
    status: null | "todo" | "in-progress" | "done";
    reward: number;
    earned?: number;
    complete_epoch?: boolean;
    guide?: string;
    frequency?: string; // daily, weekly, monthly, once -- once if undefined
    isOpen?: boolean;
};

export async function fetchProjects() {
  // Fetch projects
  const { data: projectsData, error: projectsError } = await supabasePublicClient
    .from('vr_projects')
    .select('*');

  if (projectsError) {
    console.error('Error fetching projects:', projectsError);
    return [];
  }

  // Fetch quests
  const { data: questsData, error: questsError } = await supabasePublicClient
    .from('vr_quests')
    .select('*');

  if (questsError) {
    console.error('Error fetching quests:', questsError);
    return [];
  }

  // Combine projects with their quests
  const projects = projectsData.map(project => ({
    ...project,
    quests: questsData.filter(quest => quest.project === project.id)
  }));

  return projects;
}

export default fetchProjects;