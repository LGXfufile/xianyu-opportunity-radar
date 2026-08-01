type DetailRequest = { source: 'XY_RADAR'; type: 'DETAIL_REQUEST'; requestId: string; itemId: string };

declare global {
  interface Window {
    lib?: { mtop?: MtopClient };
  }
}

type MtopClient = {
  config: Record<string, unknown>;
  request(options: Record<string, unknown>): Promise<{ ret?: string[]; data?: {
    itemDO?: { wantCnt?: number; browseCnt?: number; gmtCreate?: number | string };
    sellerDO?: { sellerId?: string | number; hasSoldNumInteger?: number; itemCount?: number };
  } }>;
};

export default defineContentScript({
  matches: ['https://www.goofish.com/search*'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    let clientPromise: Promise<MtopClient> | null = null;

    const getClient = () => {
      if (window.lib?.mtop) return Promise.resolve(window.lib.mtop);
      if (clientPromise) return clientPromise;
      clientPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://g.alicdn.com/mtb/lib-mtop/2.7.3/mtop.js';
        script.onload = () => window.lib?.mtop ? resolve(window.lib.mtop) : reject(new Error('闲鱼数据组件不可用'));
        script.onerror = () => reject(new Error('闲鱼数据组件加载失败'));
        document.head.append(script);
      });
      return clientPromise;
    };

    window.addEventListener('message', async event => {
      const request = event.data as DetailRequest;
      if (event.source !== window || request?.source !== 'XY_RADAR' || request.type !== 'DETAIL_REQUEST') return;
      try {
        const mtop = await getClient();
        Object.assign(mtop.config, { mainDomain: 'goofish.com', subDomain: 'm', LibMtopRequest: true, H5Request: true });
        const response = await mtop.request({
          api: 'mtop.taobao.idle.pc.detail', v: '1.0', data: { itemId: request.itemId }, type: 'POST',
          appKey: '34839810', accountSite: 'xianyu', dataType: 'json', timeout: 15000,
          needLogin: false, sessionOption: 'AutoLoginOnly', ecode: 0
        });
        const item = response.data?.itemDO;
        if (!item || !Number.isFinite(item.wantCnt) || !Number.isFinite(item.browseCnt)) throw new Error('商品未返回完整热度数据');
        const seller = response.data?.sellerDO;
        window.postMessage({
          source: 'XY_RADAR', type: 'DETAIL_RESPONSE', requestId: request.requestId, ok: true,
          wants: item.wantCnt, views: item.browseCnt, createdAt: item.gmtCreate,
          sellerId: seller?.sellerId, sellerSold: seller?.hasSoldNumInteger, sellerItems: seller?.itemCount
        }, '*');
      } catch (error) {
        window.postMessage({ source: 'XY_RADAR', type: 'DETAIL_RESPONSE', requestId: request.requestId, ok: false, error: error instanceof Error ? error.message : '热度数据获取失败' }, '*');
      }
    });
  }
});
