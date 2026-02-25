/**
 * High-Performance Image Loader
 * 高性能图片加载组件
 *
 * 特性：
 * 1. 懒加载（Lazy Loading）- 使用 Intersection Observer
 * 2. 骨架屏过渡（Skeleton Fade）
 * 3. 渐进式加载（Blur → Sharp）
 * 4. 错误处理（Fallback）
 * 5. 4K/8K 资产支持
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ImageLoader.css';

// ==========================================
// 类型定义
// ==========================================

export interface ImageLoaderProps {
    src: string;
    alt: string;

    // 尺寸
    width?: number;
    height?: number;
    aspectRatio?: number; // 宽高比（例：16/9）

    // 占位图
    placeholder?: string;
    fallback?: string; // 加载失败时显示的图片

    // 懒加载
    lazy?: boolean;
    threshold?: number; // 触发阈值（0-1）

    // 动画
    transition?: boolean; // 是否启用淡入动画
    transitionDuration?: number; // 淡入时长

    // 回调
    onLoad?: () => void;
    onError?: (error: Error) => void;

    // 其他
    className?: string;
    style?: React.CSSProperties;
    loading: 'lazy' | 'eager';

    // 缓存（用于调试）
    forceReload?: boolean; // 强制重新加载
}

// ==========================================
// 骨架屏组件
// ==========================================

interface SkeletonProps {
    width?: number;
    height?: number;
    aspectRatio?: number;
    className?: string;
}

export const ImageSkeleton: React.FC<SkeletonProps> = ({
    width,
    height,
    aspectRatio,
    className = '',
}) => {
    const computedStyle: React.CSSProperties = {};

    if (width) {
        computedStyle.width = `${width}px`;
    }

    if (height) {
        computedStyle.height = `${height}px`;
    }

    if (aspectRatio) {
        computedStyle.aspectRatio = `${aspectRatio}`;
    }

    return (
        <div
            className={`image-skeleton ${className}`}
            style={computedStyle}
            aria-hidden="true"
        >
            <div className="skeleton-pulse" />
        </div>
    );
};

// ==========================================
// 图片加载器组件
// ==========================================

export const ImageLoader: React.FC<ImageLoaderProps> = ({
    src,
    alt,
    width,
    height,
    aspectRatio,
    placeholder,
    fallback,
    lazy = true,
    threshold = 0.1,
    transition = true,
    transitionDuration = 300,
    onLoad,
    onError,
    className = '',
    style,
    loading = 'lazy',
    forceReload = false,
}) => {
    // ===== 状态管理 =====

    const [isLoaded, setIsLoaded] = useState(false);
    const [isError, setIsError] = useState(false);
    const [shouldLoad, setShouldLoad] = useState(!lazy); // 懒加载时初始为 false
    const [imageSrc, setImageSrc] = useState(placeholder || src);

    // Ref
    const imgRef = useRef<HTMLImageElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // ===== 样式计算 =====

    const containerStyle: React.CSSProperties = {
        ...style,
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : 'auto',
        aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
        overflow: 'hidden',
        backgroundColor: placeholder ? 'transparent' : '#f0f0f0',
        borderRadius: style?.borderRadius || '8px',
    };

    const imgStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        transition: transition
            ? `opacity ${transitionDuration}ms ease-in-out, filter ${transitionDuration}ms ease-in-out`
            : 'none',
        opacity: isLoaded ? 1 : 0,
        filter: isLoaded ? 'blur(0px)' : 'blur(10px)',
    };

    // ===== 1. 懒加载逻辑（Intersection Observer）=====

    useEffect(() => {
        if (!lazy || shouldLoad) {
            return; // 已加载或不使用懒加载
        }

        if (!imgRef.current) {
            return;
        }

        // 创建 Intersection Observer
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // 元素进入视口，开始加载
                        setShouldLoad(true);
                        // 停止观察
                        if (observerRef.current) {
                            observerRef.current.unobserve(entry.target);
                        }
                    }
                });
            },
            {
                threshold, // 触发阈值（0.1 = 10% 可见时触发）
                rootMargin: '50px 0px 50px 0px', // 提前 50px 加载
            }
        );

        // 开始观察
        observerRef.current.observe(imgRef.current);

        // 清理
        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
        };
    }, [lazy, shouldLoad, threshold]);

    // ===== 2. 图片加载逻辑 =====

    const handleLoad = useCallback(() => {
        setIsLoaded(true);
        setIsError(false);
        onLoad?.();
    }, [onLoad]);

    const handleError = useCallback(
        (error: Event) => {
            console.error('ImageLoader: 加载失败', error);
            setIsError(true);
            setIsLoaded(false);

            // 尝试加载 fallback
            if (fallback && imageSrc !== fallback) {
                setImageSrc(fallback);
            } else {
                onError?.(error as unknown as Error);
            }
        },
        [fallback, imageSrc, onError],
    );

    // ===== 3. 强制重新加载 =====

    useEffect(() => {
        if (forceReload) {
            setIsLoaded(false);
            setIsError(false);
            setImageSrc(src + `?t=${Date.now()}`);
        }
    }, [forceReload, src]);

    // ===== 4. 资源预加载（Web Worker 中可选）=====

    // 注意：这里简化处理，实际可以使用 Intersection Observer
    // 提前加载视口内的图片

    // ===== 渲染 =====

    return (
        <div className={`image-loader ${className}`} style={containerStyle}>
            {/* 骨架屏（未加载时显示） */}
            {(!isLoaded || isError) && (
                <ImageSkeleton
                    width={width}
                    height={height}
                    aspectRatio={aspectRatio}
                    className={`image-loader-skeleton ${isLoaded ? 'fading-out' : ''}`}
                />
            )}

            {/* 实际图片 */}
            (shouldLoad || !lazy) && (
                <>
                    {/* 占位图（低分辨率） */}
                    {placeholder && !isLoaded && !isError && (
                        <img
                            src={placeholder}
                            alt={`${alt} (placeholder)`}
                            className="image-loader-placeholder"
                            style={{ ...imgStyle, opacity: 1 }}
                        />
                    )}

                    {/* 实际图片（高分辨率） */}
                    <img
                        ref={imgRef}
                        src={shouldLoad || !lazy ? imageSrc : undefined}
                        alt={alt}
                        className="image-loader-image"
                        style={imgStyle}
                        onLoad={handleLoad}
                        onError={handleError}
                        loading={lazy ? 'lazy' : 'eager'}
                        decoding="async"

                        // 性能优化
                        crossOrigin="anonymous" // CDN 跨域
                    />
                </>
            )}

            {/* 错误提示 */}
            {isError && !fallback && (
                <div className="image-loader-error">图片加载失败</div>
            )}
        </div>
    );
};

// ==========================================
// 高级组件：渐近式图片加载
// ==========================================

export interface ProgressiveImageLoaderProps extends Omit<ImageLoaderProps, 'placeholder'> {
    thumbnail: string; // 缩略图（低分辨率）
    thumbnailSize: number; // 缩略图大小（例如 300）
}

/**
 * 渐进式图片加载器
 * 1. 先加载缩略图（模糊）
 * 2. 再加载高清图（清晰）
 * 3. 平滑过渡
 */
export const ProgressiveImageLoader: React.FC<ProgressiveImageLoaderProps> = ({
    src,
    thumbnail,
    thumbnailSize,
    ...props
}) => {
    const [mainImageLoaded, setMainImageLoaded] = useState(false);

    // 生成缩略图 URL（假设是 4K 图片，生成 300px 缩略图）
    // 实际应用中，可以使用 Cloudinary、Imgix 等服务自动生成缩略图
    const thumbnailUrl = thumbnail || `${src}?w=${thumbnailSize}&q=60`;

    return (
        <ImageLoader
            {...props}
            src={src}
            placeholder={thumbnailUrl}
            transitionDuration={500}
            onLoad={() => setMainImageLoaded(true)}
        />
    );
};

// ==========================================
// 高级组件：响应式图片加载器
// ==========================================

export interface ResponsiveImageLoaderProps extends Omit<ImageLoaderProps, 'src'> {
    srcSet: {
        default: string;
        sm?: string; // 640px
        md?: string; // 768px
        lg?: string; // 1024px
        xl?: string; // 1280px
        xxl?: string; // 1536px
        xxxl?: string; // 4K
    };
}

/**
 * 响应式图片加载器
 * 根据屏幕尺寸自动选择合适的分辨率
 */
export const ResponsiveImageLoader: React.FC<ResponsiveImageLoaderProps> = ({
    srcSet,
    alt,
    ...props
}) => {
    const [currentSrc, setCurrentSrc] = useState(srcSet.default);

    // 监听窗口尺寸变化
    useEffect(() => {
        const updateSrc = () => {
            const width = window.innerWidth;

            if (width >= 3840 && srcSet.xxxl) {
                setCurrentSrc(srcSet.xxxl); // 4K
            } else if (width >= 1536 && srcSet.xxl) {
                setCurrentSrc(srcSet.xxl); // 2K
            } else if (width >= 1280 && srcSet.xl) {
                setCurrentSrc(srcSet.xl);
            } else if (width >= 1024 && srcSet.lg) {
                setCurrentSrc(srcSet.lg);
            } else if (width >= 768 && srcSet.md) {
                setCurrentSrc(srcSet.md);
            } else if (width >= 640 && srcSet.sm) {
                setCurrentSrc(srcSet.sm);
            } else {
                setCurrentSrc(srcSet.default);
            }
        };

        updateSrc();
        window.addEventListener('resize', updateSrc);
        return () => window.removeEventListener('resize', updateSrc);
    }, [srcSet]);

    return <ImageLoader src={currentSrc} alt={alt} {...props} />;
};

// ==========================================
// 高级组件：图片画廊（虚拟滚动）
// ==========================================

import { useVirtualizer } from '@tanstack/react-virtual';

export interface ImageGalleryProps {
    images: Array<{
        id: string;
        src: string;
        alt: string;
        width: number;
        height: number;
    }>;
    containerHeight?: number;
}

/**
 * 图片画廊（虚拟滚动）
 * 适用于大量图片的场景（如角色图鉴）
 */
export const ImageGallery: React.FC<ImageGalleryProps> = ({
    images,
    containerHeight = 600,
}) => {
    const parentRef = useRef<HTMLDivElement>(null);

    // 虚拟滚动配置
    const rowVirtualizer = useVirtualizer({
        count: Math.ceil(images.length / 4), // 4 列
        getScrollElement: () => parentRef.current,
        estimateSize: () => 300, // 每行高度估计
        overscan: 5, // 预渲染 5 行
    });

    return (
        <div
            ref={parentRef}
            style={{
                height: `${containerHeight}px`,
                overflow: 'auto',
            }}
            className="image-gallery"
        >
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const startIdx = virtualRow.index * 4;
                    const rowImages = images.slice(startIdx, startIdx + 4);

                    return (
                        <div
                            key={virtualRow.index}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                            className="image-gallery-row"
                        >
                            {rowImages.map((img) => (
                                <div
                                    key={img.id}
                                    style={{
                                        width: '25%',
                                        height: '100%',
                                        padding: '8px',
                                    }}
                                    className="image-gallery-item"
                                >
                                    <ImageLoader
                                        src={img.src}
                                        alt={img.alt}
                                        lazy
                                        aspectRatio={img.width / img.height}
                                    />
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ImageLoader;
