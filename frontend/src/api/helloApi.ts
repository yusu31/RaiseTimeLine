import { apiRequest } from './client'

type HelloResponse = {
  message: string
}

export function fetchHello(accessToken: string): Promise<HelloResponse> {
  return apiRequest<HelloResponse>('/hello', { accessToken })
}
