function getPreviewUrl(url) {
    if (url.includes('drive.google.com/uc?id=')) {
        const idMatch = url.match(/id=([^&]+)/);
        if (idMatch) {
            return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
        }
    } else if (url.includes('drive.google.com/file/d/')) {
        return url.replace(/\/view.*$/, '/preview');
    }
    // For direct PDF links or others
    if (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().endsWith('.docx')) {
        return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    }
    return url;
}
console.log(getPreviewUrl('https://drive.google.com/uc?id=12345&export=download'));
