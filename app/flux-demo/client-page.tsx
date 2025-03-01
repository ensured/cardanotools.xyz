'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Download, Info, Settings, Image } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Skeleton } from '@/components/ui/skeleton';

// Predefined resolution options
const RESOLUTION_PRESETS = {
    'square_1024': { width: 1024, height: 1024, label: 'Square (1024×1024)' },
    'square_1536': { width: 1536, height: 1536, label: 'Square HD (1536×1536)' },
    'landscape_16_9': { width: 1920, height: 1080, label: 'Landscape 16:9 (1920×1080)' },
    'landscape_3_2': { width: 1536, height: 1024, label: 'Landscape 3:2 (1536×1024)' },
    'portrait_9_16': { width: 1080, height: 1920, label: 'Portrait 9:16 (1080×1920)' },
    'portrait_2_3': { width: 1024, height: 1536, label: 'Portrait 2:3 (1024×1536)' },
};

// Default resolution
const DEFAULT_RESOLUTION = 'square_1024';

export default function FluxDemoPage() {
    const [prompt, setPrompt] = useState('');
    const [imageData, setImageData] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [imageMetadata, setImageMetadata] = useState<{
        width: number;
        height: number;
        prompt: string;
        timestamp: string;
    } | null>(null);

    // Example prompts
    const examplePrompts = [
        {
            title: "Cyberpunk Street Market",
            text: "A vibrant cyberpunk night market in Neo-Tokyo, 2089. Narrow streets lined with glowing neon signs in pink, blue, and purple. Holographic advertisements float above crowded food stalls selling steaming ramen and synthetic sushi. Rain-slicked streets reflect the neon lights while steam rises from vents. Diverse crowd of humans with cybernetic enhancements and androids browse market stalls selling advanced tech gadgets. Towering skyscrapers loom overhead, their facades covered in massive LED screens. Photorealistic, detailed, cinematic lighting, 8K resolution."
        },
        {
            title: "Underwater Ancient Temple",
            text: "A breathtaking underwater ancient temple discovered in the depths of the Mediterranean Sea. Massive marble columns covered in colorful coral and sea anemones. Shafts of sunlight pierce through the clear turquoise water, creating ethereal light beams that illuminate the temple interior. Schools of tropical fish in vibrant blues and yellows swim between ornate stone statues of forgotten sea deities. A partially collapsed dome reveals an intricate mosaic floor depicting an ancient maritime civilization. Bubbles rise gently toward the surface. Hyper-detailed, atmospheric, professional underwater photography style."
        },
        {
            title: "Enchanted Library",
            text: "An impossibly vast magical library stretching endlessly in all directions. Towering bookshelves reach hundreds of feet high, connected by ornate spiral staircases and floating platforms. Books with glowing spines and animated covers organize themselves. Magical orbs of soft golden light float between the shelves. Wizards in flowing robes study at antique wooden desks while magical creatures like tiny dragons and phoenix birds perch on chandeliers. Dust motes sparkle in beams of colored light streaming through massive stained glass windows. Warm color palette, magical atmosphere, intricate details, fantasy illustration style."
        },
        {
            title: "Alpine Cabin Sunset",
            text: "A cozy wooden cabin nestled in the Swiss Alps at sunset. Fresh snow blankets the steep roof and surrounding pine forest. Warm golden light spills from windows onto pristine snow that sparkles with ice crystals. Smoke curls from a stone chimney into the crisp mountain air. Majestic snow-capped peaks in the background are painted in dramatic purple and orange hues from the setting sun. A frozen lake in the valley below reflects the colorful sky. Inside glimpses show a crackling fireplace and rustic wooden furniture. Photorealistic, winter landscape photography, golden hour lighting."
        }
    ];

    // Function to apply an example prompt
    const applyExamplePrompt = (promptText: string) => {
        setPrompt(promptText);
    };

    // Quality settings
    const [selectedResolution, setSelectedResolution] = useState(DEFAULT_RESOLUTION);

    // Rate limit state
    const [rateLimit, setRateLimit] = useState({
        limit: 10,
        remaining: 10,
        resetTime: null as Date | null
    });
    // State to force re-render for timer updates
    const [timerTick, setTimerTick] = useState(0);

    // Effect for countdown timer - only updates the UI, doesn't fetch rate limit
    useEffect(() => {
        // Only start the timer if we have a reset time
        if (!rateLimit.resetTime) return;

        // Setup interval to update every second
        const intervalId = setInterval(() => {
            // Force component to re-render by updating tick state
            setTimerTick(prev => prev + 1);

            // Check if reset time has passed
            const now = new Date();
            if (rateLimit.resetTime && now > rateLimit.resetTime) {
                // Instead of fetching, just update the UI to show full quota
                // The next actual API call will get the real updated values
                setRateLimit(prev => ({
                    ...prev,
                    remaining: prev.limit,
                    resetTime: null
                }));
            }
        }, 1000);

        // Cleanup interval on unmount or when reset time changes
        return () => clearInterval(intervalId);
    }, [rateLimit.resetTime, rateLimit.limit]);

    // Format time until reset
    const formatTimeUntilReset = () => {
        if (!rateLimit.resetTime) {
            // If no reset time is set, it means the user hasn't used all their downloads yet
            return null; // Return null to indicate no timer should be shown
        }

        const now = new Date();
        const timeDiff = rateLimit.resetTime.getTime() - now.getTime();

        if (timeDiff <= 0) return 'very soon';

        const minutes = Math.floor(timeDiff / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    };

    // Fetch rate limit status from API
    const fetchRateLimitStatus = async () => {
        try {
            const res = await fetch('/api/flux/rate-limit', {
                method: 'GET',
            });

            if (!res.ok) {
                console.error('Error fetching rate limit status:', res.statusText);
                return;
            }

            const data = await res.json();

            // Update rate limit state with accurate data from Vercel KV
            setRateLimit({
                limit: data.limit,
                remaining: data.remaining,
                resetTime: data.resetTime ? new Date(data.resetTime) : null
            });
        } catch (err) {
            console.error('Error fetching rate limit status:', err);
        }
    };

    // Initial rate limit check - only once when component mounts
    useEffect(() => {
        // Fetch initial rate limit status when component mounts
        fetchRateLimitStatus();

        // No more periodic polling
    }, []);

    // Get current resolution settings
    const getCurrentResolution = () => {
        return RESOLUTION_PRESETS[selectedResolution as keyof typeof RESOLUTION_PRESETS];
    };

    // Handle download button click
    const handleDownload = () => {
        if (!imageData) return;

        // Create an anchor element and trigger download
        const link = document.createElement('a');

        // Set file name with metadata if available
        let fileName = 'flux-image.jpg';
        if (imageMetadata) {
            // Format timestamp to be filesystem-friendly
            const timestamp = new Date(imageMetadata.timestamp)
                .toISOString()
                .replace(/:/g, '-')
                .replace(/\..+/, '');

            // Create a clean prompt slug for the filename (first 30 chars)
            const promptSlug = imageMetadata.prompt
                .toLowerCase()
                .replace(/[^\w\s]/g, '')  // Remove special chars
                .replace(/\s+/g, '_')     // Replace spaces with underscores
                .substring(0, 30);        // Limit length

            fileName = `flux_${timestamp}_${promptSlug}.jpg`;
        }

        // Remove the data URL prefix to get just the base64 data
        const base64Data = imageData.split(',')[1];

        // Create a blob URL for the image
        const blobUrl = URL.createObjectURL(
            base64ToBlob(base64Data, 'image/jpeg')
        );

        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    };

    // Convert base64 to Blob
    const base64ToBlob = (base64: string, mimeType: string) => {
        const byteCharacters = atob(base64);
        const byteArrays = [];

        for (let i = 0; i < byteCharacters.length; i += 512) {
            const slice = byteCharacters.slice(i, i + 512);
            const byteNumbers = new Array(slice.length);

            for (let j = 0; j < slice.length; j++) {
                byteNumbers[j] = slice.charCodeAt(j);
            }

            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }

        return new Blob(byteArrays, { type: mimeType });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setImageData('');
        setImageMetadata(null);

        try {
            const resolution = getCurrentResolution();

            const res = await fetch('/api/flux', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt,
                    width: resolution.width,
                    height: resolution.height,
                    highQuality: false // Always set to false since we removed the toggle
                }),
            });

            // After image generation, fetch the updated rate limit status
            fetchRateLimitStatus();

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            setImageData(data.imageData);
            setImageMetadata(data.metadata);
        } catch (err) {
            console.error('Error:', err);
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container py-8 mx-auto">
            <h1 className="mb-8 text-3xl font-bold text-center">FLUX.1-dev Image Generator</h1>

            {/* Rate Limit Indicator */}
            <Card className="mb-6">
                <CardContent className="pt-6">
                    <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <h3 className="text-sm font-medium">Rate Limit Status</h3>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="ml-2">
                                                <Info className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>You can generate up to {rateLimit.limit} images per hour</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {rateLimit.remaining === 0 && formatTimeUntilReset()
                                    ? `Resets in ${formatTimeUntilReset()}`
                                    : rateLimit.remaining < rateLimit.limit
                                        ? `${rateLimit.remaining} of ${rateLimit.limit} remaining`
                                        : `${rateLimit.limit} images available`}
                            </span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Progress
                                value={(rateLimit.remaining / rateLimit.limit) * 100}
                                className="h-2 flex-1"
                            />
                            <div className="font-medium text-sm">
                                {rateLimit.remaining}/{rateLimit.limit}
                            </div>
                        </div>
                        {rateLimit.remaining === 0 && (
                            <div className="mt-1 flex items-center text-amber-500 text-sm">
                                <AlertCircle className="mr-1 h-4 w-4" />
                                {formatTimeUntilReset()
                                    ? `Rate limit reached. Try again in ${formatTimeUntilReset()}.`
                                    : 'Rate limit reached. Please wait for reset.'}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Input</CardTitle>
                        <VisuallyHidden>
                            <CardDescription>prompt</CardDescription>
                        </VisuallyHidden>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-2">
                            <div className="space-y-2">
                                <Label htmlFor="prompt">Prompt</Label>
                                <Textarea
                                    id="prompt"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe the image you want to generate..."
                                    className="min-h-[150px]"
                                    required
                                />

                                {/* Example Prompts */}
                                <div className="mt-2">
                                    <Label className="text-xs text-gray-500 mb-2 block">Example Prompts:</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {examplePrompts.map((example, index) => (
                                            <Button
                                                key={index}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => applyExamplePrompt(example.text)}
                                                className="text-xs"
                                            >
                                                {example.title}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Image Resolution Settings */}
                            <div className="pt-4">
                                <Label className="mb-2 block">Image Settings</Label>
                                <div className="flex flex-col space-y-3">
                                    <div>
                                        <Label htmlFor="resolution" className="text-xs text-gray-500 mb-1 block">Resolution</Label>
                                        <Select
                                            value={selectedResolution}
                                            onValueChange={setSelectedResolution}
                                        >
                                            <SelectTrigger id="resolution">
                                                <SelectValue placeholder="Select Resolution" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(RESOLUTION_PRESETS).map(([key, preset]) => (
                                                    <SelectItem key={key} value={key}>
                                                        {preset.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </CardContent>
                    <CardFooter>
                        <Button
                            onClick={handleSubmit}
                            disabled={loading || !prompt.trim() || rateLimit.remaining === 0}
                            className="w-full"
                        >
                            {loading ? 'Generating...' : 'Generate Image'}
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Output</CardTitle>
                                <CardDescription>Generated image from FLUX.1-dev</CardDescription>
                            </div>
                            {imageData && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleDownload}
                                    className="h-9 w-9"
                                    title="Download full quality image"
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <div className="p-4 mb-4 text-white bg-red-500 rounded-md">
                                {error}
                            </div>
                        )}
                        {imageData ? (
                            <div className="flex justify-center">
                                <div className="relative overflow-hidden rounded-lg border border-gray-200 shadow-md">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={imageData}
                                        alt="Generated image"
                                        className="w-full h-auto"
                                    />

                                    {/* Image metadata overlay */}
                                    {imageMetadata && (
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2">
                                            <div className="flex justify-between">
                                                <span>{imageMetadata.width}×{imageMetadata.height}</span>
                                                <span>{new Date(imageMetadata.timestamp).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 border rounded-md overflow-hidden">
                                {loading ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center space-y-4 p-6">
                                        {/* Skeleton for the image being generated */}
                                        <div className="relative w-full h-full">
                                            <Skeleton className="w-full h-48 rounded-md" />

                                            {/* Animated gradient overlay to make it more interesting */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />

                                            {/* Skeleton for metadata bar */}
                                            <div className="absolute bottom-0 left-0 right-0 flex justify-between p-2 bg-black/20">
                                                <Skeleton className="h-4 w-16" />
                                                <Skeleton className="h-4 w-24" />
                                            </div>
                                        </div>

                                        <div className="text-sm text-muted-foreground mt-2 flex items-center space-x-2">
                                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                                            <span>Generating your masterpiece...</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center space-y-3 p-6 text-muted-foreground">
                                        <Image className="h-10 w-10 opacity-40" />
                                        <p>Generated image will appear here</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
} 