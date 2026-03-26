import { test, expect, vi } from 'vitest';
import { queryAreaData } from "../services/ApiService.js";

test('queryAreaData calls execQuery once', async () => {
    const mockExec = vi.fn().mockResolvedValue({ elements: [] });

    const mockApi = { execQuery: mockExec };

    const result = await queryAreaData(50, 10, 1000, mockApi);

    expect(mockExec).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ elements: [] });
});