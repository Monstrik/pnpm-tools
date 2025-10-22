const os = require('os');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Resolves the lockfile path - can be absolute or relative to cwd
 */
function resolveLockfilePath(input) {
    if (!input) return null;
    return path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);
}

/**
 * Finds .npmrc in multiple locations (project root, home directory)
 */
function findNpmrcFiles(lockfilePath) {
    const locations = [
        path.join(os.homedir(), '.npmrc'), // User-level
    ];

    // If a lockfile is provided, check for project-level .npmrc
    if (lockfilePath) {
        const projectRoot = path.dirname(lockfilePath);
        locations.unshift(path.join(projectRoot, '.npmrc')); // Project-level takes precedence
    }

    return locations.filter(fs.existsSync);
}

/**
 * Parse .npmrc for default and scoped registry mappings
 * Merges multiple .npmrc files (project overrides home)
 */
function parseNpmrc(filePaths) {
    const registryMap = {};
    let defaultRegistry = 'https://registry.npmjs.org/';

    for (const filePath of filePaths.reverse()) { // Home first, then project overrides
        if (!fs.existsSync(filePath)) continue;

        const lines = fs.readFileSync(filePath, 'utf8').split('\n');
        for (const line of lines) {
            const cleanLine = line.trim().split('#')[0]; // Remove comments
            if (!cleanLine) continue;

            // Match scoped registry
            const scopedMatch = cleanLine.match(/^(@[^:]+):registry\s*=\s*(.+)$/);
            if (scopedMatch) {
                const [, scope, registry] = scopedMatch;
                registryMap[scope] = registry.trim();
                continue;
            }

            // Match default registry
            const defaultMatch = cleanLine.match(/^registry\s*=\s*(.+)$/);
            if (defaultMatch) {
                defaultRegistry = defaultMatch[1].trim();
            }
        }
    }

    return { registryMap, defaultRegistry };
}

/**
 * Extract scopes from pnpm-lock.yaml
 */
function extractScopes(lockPath) {
    const scopes = new Set();

    if (!fs.existsSync(lockPath)) {
        throw new Error(`Lockfile not found: ${lockPath}`);
    }

    try {
        const lockData = yaml.load(fs.readFileSync(lockPath, 'utf8'));
        const packages = lockData?.packages || {};

        for (const pkg of Object.keys(packages)) {
            const match = pkg.match(/^(@[^/]+)\//);
            if (match) scopes.add(match[1]);
        }
    } catch (error) {
        throw new Error(`Failed to parse lockfile: ${error.message}`);
    }

    return scopes;
}

/**
 * Extract packages by registry from pnpm-lock.yaml
 */
function extractPackagesByRegistry(lockPath, registryMap, defaultRegistry) {
    const packagesByRegistry = {};

    if (!fs.existsSync(lockPath)) {
        throw new Error(`Lockfile not found: ${lockPath}`);
    }

    try {
        const lockData = yaml.load(fs.readFileSync(lockPath, 'utf8'));
        const packages = lockData?.packages || {};

        for (const pkg of Object.keys(packages)) {
            // Extract scope if it exists
            const scopeMatch = pkg.match(/^(@[^/]+)\//);

            if (scopeMatch) {
                const scope = scopeMatch[1];
                const registry = registryMap[scope];

                // Only include packages with a non-default registry
                if (registry && registry !== defaultRegistry) {
                    if (!packagesByRegistry[registry]) {
                        packagesByRegistry[registry] = [];
                    }
                    packagesByRegistry[registry].push(pkg);
                }
            }
        }
    } catch (error) {
        throw new Error(`Failed to parse lockfile: ${error.message}`);
    }

    return packagesByRegistry;
}

/**
 * Format and display the registry summary
 */
function displaySummary(scopes, registryMap, packagesByRegistry, defaultRegistry, npmrcFiles) {
    console.log('## 📦 Registry Summary');
    console.log('📄 .npmrc files used:');
    npmrcFiles.forEach(file => console.log(`\t${file}`));
    console.log(`🔧 Registries:\n\tDefault → ${defaultRegistry}`);
    Object.entries(registryMap).forEach(([scope, registry]) => {
        console.log(`\t${scope} → ${registry}`);
    });

    const registries = Object.keys(packagesByRegistry);
    
    if (registries.length === 0) {
        console.log('✅ All packages use the default registry.');
        return;
    }

    console.log('\n⚠️  Packages from non-default registries:');
    
    for (const registry of registries) {
        const packages = packagesByRegistry[registry].sort();
        console.log(`\t📍 ${registry}`);
        packages.forEach(pkg => console.log(`\t${pkg}`));
        console.log();
    }
    
    const totalPackages = Object.values(packagesByRegistry).flat().length;
    console.log(`📊 Total: ${totalPackages} package(s) from ${registries.length} custom registr${registries.length === 1 ? 'y' : 'ies'}`);
}


/**
 * Main execution
 */
function main() {
    const lockfileArg = process.argv[2];

    if (!lockfileArg) {
        console.error('❌ Please provide the path to pnpm-lock.yaml as an argument.');
        console.error('\nUsage: node pnpm-registry-summary.js <path-to-pnpm-lock.yaml>');
        console.error('\nExamples:');
        console.error('  node pnpm-registry-summary.js ./pnpm-lock.yaml');
        console.error('  node pnpm-registry-summary.js /absolute/path/to/pnpm-lock.yaml');
        process.exit(1);
    }

    const lockfilePath = resolveLockfilePath(lockfileArg);

    if (!lockfilePath || !fs.existsSync(lockfilePath)) {
        console.error(`❌ Lockfile not found: ${lockfilePath || lockfileArg}`);
        process.exit(1);
    }

    try {
        const npmrcFiles = findNpmrcFiles(lockfilePath);
        const { registryMap, defaultRegistry } = parseNpmrc(npmrcFiles);
        const scopes = extractScopes(lockfilePath);
        const packagesByRegistry = extractPackagesByRegistry(lockfilePath, registryMap, defaultRegistry);
        
        displaySummary(scopes, registryMap, packagesByRegistry, defaultRegistry, npmrcFiles);
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}
//
// // Export for testing
// module.exports = {
//     parseNpmrc,
//     extractScopes,
//     extractPackagesByRegistry,
//     resolveLockfilePath,
//     findNpmrcFiles
// };