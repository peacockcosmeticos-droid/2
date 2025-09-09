const { test, expect } = require('@playwright/test');

test.describe('Swiper Gallery - Optimized Images', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navegar para a página principal
    await page.goto('http://localhost:3000/index.html');
    
    // Aguardar o Swiper carregar
    await page.waitForSelector('#stories-swiper', { timeout: 10000 });
  });

  test('deve carregar o Swiper com elementos picture', async ({ page }) => {
    // Verificar se o Swiper está presente
    const swiper = await page.locator('#stories-swiper');
    await expect(swiper).toBeVisible();

    // Verificar se existem slides
    const slides = await page.locator('#stories-swiper .swiper-slide');
    const slideCount = await slides.count();
    expect(slideCount).toBeGreaterThan(0);

    // Verificar se a primeira imagem usa elemento picture
    const firstPicture = await page.locator('#stories-swiper .swiper-slide picture').first();
    await expect(firstPicture).toBeVisible();
  });

  test('deve ter múltiplos formatos de imagem (AVIF, WebP, JPG)', async ({ page }) => {
    // Verificar se existem sources AVIF
    const avifSources = await page.locator('#stories-swiper picture source[type="image/avif"]');
    const avifCount = await avifSources.count();
    expect(avifCount).toBeGreaterThan(0);

    // Verificar se existem sources WebP
    const webpSources = await page.locator('#stories-swiper picture source[type="image/webp"]');
    const webpCount = await webpSources.count();
    expect(webpCount).toBeGreaterThan(0);

    // Verificar se existem imagens JPG como fallback
    const jpgImages = await page.locator('#stories-swiper picture img[src*=".jpg"]');
    const jpgCount = await jpgImages.count();
    expect(jpgCount).toBeGreaterThan(0);
  });

  test('deve implementar lazy loading corretamente', async ({ page }) => {
    // Verificar se existem imagens com loading="lazy" (a maioria deve ter)
    const lazyImages = await page.locator('#stories-swiper .swiper-slide picture img[loading="lazy"]');
    const lazyCount = await lazyImages.count();
    expect(lazyCount).toBeGreaterThan(0);

    // Outras imagens devem ter loading="lazy"
    const otherImages = await page.locator('#stories-swiper .swiper-slide picture img').nth(1);
    if (await otherImages.count() > 0) {
      const otherLoadingAttr = await otherImages.getAttribute('loading');
      expect(otherLoadingAttr).toBe('lazy');
    }
  });

  test('deve navegar pelo Swiper corretamente', async ({ page }) => {
    // Verificar se o Swiper permite navegação horizontal
    const swiperWrapper = await page.locator('#stories-swiper .swiper-wrapper');
    await expect(swiperWrapper).toBeVisible();

    // Simular scroll horizontal
    await swiperWrapper.hover();
    await page.mouse.wheel(100, 0);
    
    // Aguardar um momento para a animação
    await page.waitForTimeout(500);
    
    // Verificar se ainda está visível após navegação
    await expect(swiperWrapper).toBeVisible();
  });

  test('deve abrir modal ao clicar em story', async ({ page }) => {
    // Clicar no primeiro story avatar
    const firstStoryBtn = await page.locator('.story-avatar').first();
    await firstStoryBtn.click();

    // Verificar se o modal abriu
    const modal = await page.locator('#stories-modal-v2');
    await expect(modal).toBeVisible();

    // Verificar se o player swiper está presente
    const playerSwiper = await page.locator('#stories-player-swiper');
    await expect(playerSwiper).toBeVisible();
  });

  test('deve carregar imagens otimizadas no modal', async ({ page }) => {
    // Abrir o modal do story "Antes/Depois"
    const antesDepoisBtn = await page.locator('.story-avatar[data-story-index="1"]');
    await antesDepoisBtn.click();

    // Aguardar o modal carregar
    await page.waitForSelector('#stories-modal-v2', { state: 'visible' });

    // Verificar se as imagens no modal usam elementos picture
    const modalPictures = await page.locator('#stories-player-swiper picture');
    await expect(modalPictures).toHaveCountGreaterThan(0);

    // Verificar formatos múltiplos no modal
    const modalAvifSources = await page.locator('#stories-player-swiper picture source[type="image/avif"]');
    await expect(modalAvifSources).toHaveCountGreaterThan(0);
  });

  test('deve ser responsivo em diferentes tamanhos de tela', async ({ page }) => {
    // Testar em mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    const swiper = await page.locator('#stories-swiper');
    await expect(swiper).toBeVisible();
    
    // Verificar se as imagens mantêm proporção
    const images = await page.locator('#stories-swiper picture img');
    const firstImg = images.first();
    const boundingBox = await firstImg.boundingBox();
    
    expect(boundingBox.width).toBeLessThanOrEqual(80); // Máximo 80px em mobile
    expect(boundingBox.height).toBeLessThanOrEqual(80);

    // Testar em desktop
    await page.setViewportSize({ width: 1200, height: 800 });
    
    await expect(swiper).toBeVisible();
    
    // Verificar se ainda funciona em desktop
    const desktopBoundingBox = await firstImg.boundingBox();
    expect(desktopBoundingBox.width).toBeGreaterThan(0);
    expect(desktopBoundingBox.height).toBeGreaterThan(0);
  });

  test('deve ter acessibilidade adequada', async ({ page }) => {
    // Verificar alt texts
    const images = await page.locator('#stories-swiper picture img');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const altText = await img.getAttribute('alt');
      expect(altText).toBeTruthy();
      expect(altText.length).toBeGreaterThan(0);
    }

    // Verificar ARIA labels nos botões
    const storyButtons = await page.locator('.story-avatar');
    const buttonCount = await storyButtons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = storyButtons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel.length).toBeGreaterThan(0);
    }
  });

  test('deve fechar modal corretamente', async ({ page }) => {
    // Abrir modal
    const firstStoryBtn = await page.locator('.story-avatar').first();
    await firstStoryBtn.click();

    const modal = await page.locator('#stories-modal-v2');
    await expect(modal).toBeVisible();

    // Fechar modal clicando no botão X
    const closeBtn = await page.locator('#stories-close-v2');
    await closeBtn.click();

    // Verificar se o modal fechou
    await expect(modal).not.toBeVisible();
  });

  test('deve carregar todas as imagens na galeria de produtos', async ({ page }) => {
    // Aguardar a galeria de produtos carregar
    await page.waitForSelector('.product-swiper', { timeout: 10000 });

    // Verificar se existem 18 slides (7 originais + 11 antesedepois)
    const slides = await page.locator('.product-swiper .swiper-slide');
    await expect(slides).toHaveCount(18);

    // Verificar se todas as imagens carregaram
    const images = await page.locator('.product-swiper picture img');
    await expect(images).toHaveCount(18);

    // Verificar se as imagens antesedepois estão presentes
    const antesDepoisImages = await page.locator('.product-swiper img[src*="antesedepois"]');
    await expect(antesDepoisImages).toHaveCount(11);
  });

  test('deve carregar todos os thumbnails na galeria', async ({ page }) => {
    // Aguardar a galeria de thumbnails carregar
    await page.waitForSelector('.thumbnail-gallery', { timeout: 10000 });

    // Verificar se existem 17 thumbnails (6 originais + 11 antesedepois)
    const thumbnails = await page.locator('.thumbnail-gallery .thumbnail');
    await expect(thumbnails).toHaveCount(17);

    // Verificar se os thumbnails antesedepois estão presentes
    const antesDepoisThumbnails = await page.locator('.thumbnail-gallery img[src*="antesedepois"]');
    await expect(antesDepoisThumbnails).toHaveCount(11);
  });

  test('deve navegar pelos slides da galeria de produtos', async ({ page }) => {
    // Aguardar a galeria carregar
    await page.waitForSelector('.product-swiper', { timeout: 10000 });

    // Clicar no botão next algumas vezes para navegar
    const nextBtn = await page.locator('.product-next');
    await nextBtn.click();
    await page.waitForTimeout(500);
    await nextBtn.click();
    await page.waitForTimeout(500);

    // Verificar se a navegação funciona
    const activeSlide = await page.locator('.product-swiper .swiper-slide-active');
    await expect(activeSlide).toBeVisible();
  });

  test('deve carregar formatos otimizados (AVIF, WebP)', async ({ page }) => {
    // Aguardar a galeria carregar
    await page.waitForSelector('.product-swiper', { timeout: 10000 });

    // Verificar se elementos picture estão presentes
    const pictureElements = await page.locator('.product-swiper picture');
    await expect(pictureElements).toHaveCount(18);

    // Verificar se sources AVIF estão presentes
    const avifSources = await page.locator('.product-swiper source[type="image/avif"]');
    await expect(avifSources).toHaveCount(18);

    // Verificar se sources WebP estão presentes
    const webpSources = await page.locator('.product-swiper source[type="image/webp"]');
    await expect(webpSources).toHaveCount(18);
  });
});
