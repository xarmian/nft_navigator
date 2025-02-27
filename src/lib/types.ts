export interface Tweet {
    'Tweet ID': string;
    'Text': string;
    'Created At': string;
    'Author ID': string;
    'Username': string;
    'Like Count': number;
    'Retweet Count': number;
    'Reply Count': number;
    [key: string]: string | number;  // Allow for additional fields
} 