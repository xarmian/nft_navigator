export function reformatTokenName(name: string) {
    const match = name.match(/^(.*?)(\d+)$/);
    if (match) {
        const baseName = match[1].trim();
        const number = match[2];
        return `${baseName} #${number}`;
    } else {
        return name;
    }
}
