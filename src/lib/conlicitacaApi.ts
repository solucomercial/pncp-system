// src/utils/conlicitacaoApi.ts
import axios from 'axios';

const BASE_URL = 'https://consultaonline.conlicitacao.com.br/api';
const TOKEN = process.env.CONLICITACAO_AUTH_TOKEN;

export const conlicitacaoApi = axios.create({
 baseURL: BASE_URL,
 headers: {
  'x-auth-token': TOKEN || '',
 },
});

export async function getFiltrosCliente() {
 const response = await conlicitacaoApi.get('/filtros');
 return response.data;
}

export async function getBoletins(filtroId: number, page = 1, perPage = 10) {
 const response = await conlicitacaoApi.get(
  `/filtro/${filtroId}/boletins?page=${page}&per_page=${perPage}&order=desc`
 );
 return response.data.boletins;
}

export async function getDetalhesBoletim(boletimId: number) {
 const response = await conlicitacaoApi.get(`/boletim/${boletimId}`);
 return response.data;
}
