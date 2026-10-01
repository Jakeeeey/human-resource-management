import { ManpowerRequest } from '../types';

export const fetchAllManpowerRequests = async (): Promise<ManpowerRequest[]> => {
    const res = await fetch('/api/hrm/manpower-request');
    if (!res.ok) throw new Error('Failed to fetch');
    const json = await res.json();
    return json.data || [];
};

export const createManpowerRequest = async (data: ManpowerRequest): Promise<ManpowerRequest> => {
    const res = await fetch('/api/hrm/manpower-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to create');
    }
    const json = await res.json();
    return json;
};

export const updateManpowerRequest = async (id: number, data: Partial<ManpowerRequest>): Promise<ManpowerRequest> => {
    const res = await fetch(`/api/hrm/manpower-request?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to update');
    }
    const json = await res.json();
    return json;
};
